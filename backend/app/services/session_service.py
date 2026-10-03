"""Sesi baca: waktu baca dihitung di server dari heartbeat, bukan dari timer klien.

Setiap heartbeat menambah `active_seconds` sebesar selisih waktu sejak heartbeat sebelumnya
(dibatasi `session.heartbeat_max_gap_seconds`) hanya bila sesi sedang aktif. Celah panjang
(layar mati, tab ditutup, jaringan putus) tidak ikut dihitung.
"""

import re
from dataclasses import dataclass
from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock, media
from app.core import db as db_module
from app.core.errors import AppError
from app.repositories import books, catalog, leaderboard_cache, posts, sessions
from app.schemas.points import AwardOut, PointsResultOut, StreakOut
from app.schemas.sessions import (
    FinishIn,
    FinishOut,
    SessionBookOut,
    SessionConfigOut,
    SessionOut,
    TodayOut,
)
from app.services import (
    badge_service,
    points_service,
    post_service,
    quest_service,
    shelf_service,
    social_service,
    streak_service,
    target_service,
)
from app.services.note_validation import DEFAULT_MIN_WORDS, NoteRules, check_note, message_for
from app.services.upload_service import owns_key

HEARTBEAT_INTERVAL_SECONDS = 15
STALE_AFTER = timedelta(hours=6)
HASHTAG_RE = re.compile(r"#([\w-]{2,30})", re.UNICODE)
MAX_TOPICS = 5


@dataclass
class SessionConfig:
    min_seconds: int
    micro_min_seconds: int
    idle_timeout_seconds: int
    max_gap_seconds: int
    min_words: dict[str, int]
    min_unique_ratio: float
    max_paste_ratio: float


async def load_config(db: AsyncDatabase) -> SessionConfig:
    get = catalog.get_setting
    return SessionConfig(
        min_seconds=int(await get(db, "session.min_minutes", 15)) * 60,
        micro_min_seconds=int(await get(db, "session.micro_min_minutes", 5)) * 60,
        idle_timeout_seconds=int(await get(db, "session.idle_timeout_seconds", 300)),
        max_gap_seconds=int(await get(db, "session.heartbeat_max_gap_seconds", 45)),
        min_words={**DEFAULT_MIN_WORDS, **dict(await get(db, "note.min_words", {}) or {})},
        min_unique_ratio=float(await get(db, "note.min_unique_word_ratio", 0.4)),
        max_paste_ratio=float(await get(db, "note.max_paste_ratio", 0.5)),
    )


def config_out(cfg: SessionConfig) -> SessionConfigOut:
    return SessionConfigOut(
        min_seconds=cfg.min_seconds,
        micro_min_seconds=cfg.micro_min_seconds,
        idle_timeout_seconds=cfg.idle_timeout_seconds,
        heartbeat_interval_seconds=HEARTBEAT_INTERVAL_SECONDS,
        note_min_words=cfg.min_words,
        note_min_unique_ratio=cfg.min_unique_ratio,
        note_max_paste_ratio=cfg.max_paste_ratio,
    )


def required_seconds(session: dict, cfg: SessionConfig) -> int:
    """Durasi minimal agar sesi bisa diselesaikan: sesi kilat lebih pendek."""
    return cfg.micro_min_seconds if session.get("mode") == "micro" else cfg.min_seconds


def to_out(session: dict, cfg: SessionConfig) -> SessionOut:
    book = session["book"]
    cover = book.get("cover_image_key")
    return SessionOut(
        id=session["_id"],
        book=SessionBookOut(
            id=session["book_id"],
            title=book["title"],
            authors=book["authors"],
            cover_url=media.signed_url(cover) if cover else None,
        ),
        status=session["status"],
        mode=session.get("mode", "standard"),
        active_seconds=session["active_seconds"],
        min_seconds=required_seconds(session, cfg),
        started_at=session["started_at"],
        ended_at=session.get("ended_at"),
        local_date=session["local_date"],
        is_full_points=session.get("is_full_points", False),
        post_id=session.get("post_id"),
    )


def _credit(session: dict, max_gap: int) -> int:
    if session["status"] != "active":
        return 0
    elapsed = (clock.now() - session["last_heartbeat_at"]).total_seconds()
    return int(max(0, min(elapsed, max_gap)))


def _is_stale(session: dict) -> bool:
    return clock.now() - session["last_heartbeat_at"] > STALE_AFTER


async def _abandon(db: AsyncDatabase, session: dict) -> None:
    now = clock.now()
    await sessions.set_fields(
        db, session["_id"], {"status": "abandoned", "ended_at": now, "updated_at": now}
    )


async def get_open(db: AsyncDatabase, user: dict) -> dict | None:
    session = await sessions.find_open(db, user["_id"])
    if session and _is_stale(session):
        await _abandon(db, session)
        return None
    return session


async def today(db: AsyncDatabase, user: dict) -> TodayOut:
    cfg = await load_config(db)
    local = clock.local_date(clock.now(), user.get("timezone", "Asia/Jakarta"))
    open_session = await get_open(db, user)
    return TodayOut(
        local_date=local,
        full_points_done=await sessions.has_full_points_on(db, user["_id"], local),
        active_session=to_out(open_session, cfg) if open_session else None,
        minutes_today=await sessions.completed_seconds_on(db, user["_id"], local) // 60,
        min_minutes=cfg.min_seconds // 60,
    )


async def start(db: AsyncDatabase, user: dict, book_id: ObjectId, mode: str = "standard") -> dict:
    book = await books.get(db, book_id)
    if book is None:
        raise AppError(404, "book_not_found", "Buku tidak ditemukan")
    if await get_open(db, user):
        raise AppError(
            409, "active_session_exists", "Selesaikan atau batalkan sesi yang sedang berjalan dulu"
        )
    now = clock.now()
    doc = {
        "user_id": user["_id"],
        "book_id": book_id,
        "book": {
            "title": book["title"],
            "authors": book["authors"],
            "cover_image_key": book.get("cover_image_key"),
        },
        "local_date": clock.local_date(now, user.get("timezone", "Asia/Jakarta")),
        "started_at": now,
        "ended_at": None,
        "active_seconds": 0,
        "last_heartbeat_at": now,
        "status": "active",
        "mode": mode,
        "note_type": None,
        "post_id": None,
        "validation": None,
        "is_full_points": False,
        "page_progress": None,
        "created_at": now,
        "updated_at": now,
    }
    doc["_id"] = await sessions.insert(db, doc)
    await shelf_service.set_status(db, user["_id"], book_id, "reading", automatic=True)
    return doc


async def _get_open_owned(db: AsyncDatabase, user: dict, session_id: ObjectId) -> dict:
    session = await sessions.get_owned(db, session_id, user["_id"])
    if session is None:
        raise AppError(404, "session_not_found", "Sesi tidak ditemukan")
    if session["status"] not in sessions.OPEN_STATUSES:
        raise AppError(409, "session_closed", "Sesi ini sudah selesai")
    return session


async def heartbeat(db: AsyncDatabase, user: dict, session_id: ObjectId, state: str) -> dict:
    cfg = await load_config(db)
    for _ in range(3):
        session = await _get_open_owned(db, user, session_id)
        now = clock.now()
        updated = await sessions.update_if_unchanged(
            db,
            session_id,
            session["last_heartbeat_at"],
            {
                "active_seconds": session["active_seconds"] + _credit(session, cfg.max_gap_seconds),
                "status": state,
                "last_heartbeat_at": now,
                "updated_at": now,
            },
        )
        if updated:
            return updated
    raise AppError(409, "session_conflict", "Sesi sedang diperbarui, coba lagi")


async def abandon(db: AsyncDatabase, user: dict, session_id: ObjectId) -> None:
    session = await _get_open_owned(db, user, session_id)
    await _abandon(db, session)


def _topics(content: str, category_code: str | None) -> list[str]:
    tags = [t.lower() for t in HASHTAG_RE.findall(content)]
    if category_code:
        tags.insert(0, category_code)
    return list(dict.fromkeys(tags))[:MAX_TOPICS]


async def finish(db: AsyncDatabase, user: dict, session_id: ObjectId, data: FinishIn) -> FinishOut:
    cfg = await load_config(db)
    session = await _get_open_owned(db, user, session_id)
    now = clock.now()
    active_seconds = session["active_seconds"] + _credit(session, cfg.max_gap_seconds)
    required = required_seconds(session, cfg)

    if active_seconds < required:
        # Simpan waktu yang sudah terkumpul agar tidak hilang.
        await sessions.set_fields(
            db,
            session_id,
            {"active_seconds": active_seconds, "last_heartbeat_at": now, "updated_at": now},
        )
        remaining = (required - active_seconds + 59) // 60
        raise AppError(
            422,
            "session_too_short",
            f"Baca {remaining} menit lagi untuk menyelesaikan sesi "
            f"(minimal {required // 60} menit).",
            {"active_seconds": active_seconds, "min_seconds": required},
        )

    rules = NoteRules(
        min_words=int(cfg.min_words.get(data.note_type, DEFAULT_MIN_WORDS[data.note_type])),
        min_unique_ratio=cfg.min_unique_ratio,
        max_paste_ratio=cfg.max_paste_ratio,
    )
    check = check_note(data.content, rules, data.pasted_chars)
    if check.passed and await posts.exists_with_hash(db, user["_id"], check.content_hash):
        check.reasons.append("duplicate")
    if not check.passed:
        raise AppError(
            422,
            "note_rejected",
            message_for(check.reasons[0], data.note_type, rules, check.word_count),
            {
                "reasons": check.reasons,
                "word_count": check.word_count,
                "unique_word_ratio": check.unique_word_ratio,
            },
        )

    if any(not owns_key(user["_id"], key) for key in data.image_keys):
        raise AppError(422, "invalid_image", "Foto tidak valid, unggah ulang fotonya")

    book = await books.get(db, session["book_id"])
    if book is None:
        raise AppError(404, "book_not_found", "Buku tidak ditemukan")
    if data.is_book_finished and await posts.has_finished_book(db, user["_id"], book["_id"]):
        raise AppError(422, "book_already_finished", "Kamu sudah pernah menyelesaikan buku ini")

    mentions = await social_service.validate_mentions(db, data.mention_ids)
    category = await catalog.get_category(db, book["category_id"])
    local = clock.local_date(now, user.get("timezone", "Asia/Jakarta"))
    first_time_reader = not await sessions.has_completed_book(db, user["_id"], book["_id"])
    total_pages = data.total_pages or book.get("total_pages")
    page_progress = (
        {"current_page": data.current_page, "total_pages": total_pages}
        if data.current_page is not None
        else None
    )

    post = {
        "author_id": user["_id"],
        "author": {
            "name": user["name"],
            "avatar_url": user.get("avatar_url"),
            "function_id": user.get("function_id"),
        },
        "session_id": session_id,
        "book_id": book["_id"],
        "book": {
            "title": book["title"],
            "authors": book["authors"],
            "category_id": book["category_id"],
        },
        "type": data.note_type,
        "takeaway_kind": data.takeaway_kind,
        "content": data.content.strip(),
        "word_count": check.word_count,
        "content_hash": check.content_hash,
        "image_keys": data.image_keys,
        "rating": data.rating,
        "page_progress": page_progress,
        "is_book_finished": data.is_book_finished,
        "topics": _topics(data.content, category["code"] if category else None),
        "mentions": mentions,
        "counts": {
            "like": 0,
            "insightful": 0,
            "inspiring": 0,
            "want_to_read": 0,
            "comments": 0,
            "bookmarks": 0,
        },
        "visibility": "team",
        "moderation": {"status": "visible", "by": None, "reason": None, "at": None},
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }

    points_before = int((user.get("stats") or {}).get("points_total", 0))
    # Poin penuh harian bila total menit hari ini (termasuk sesi kilat sebelumnya) mencapai
    # durasi minimal: lima sesi 3–5 menit di sela kerja tetap dihitung sebagai sesi valid.
    read_today = await sessions.completed_seconds_on(db, user["_id"], local)
    full_points = (
        not await sessions.has_full_points_on(db, user["_id"], local)
        and read_today + active_seconds >= cfg.min_seconds
    )
    while True:
        post.pop("_id", None)
        try:
            awards, streak = await _commit_finish(
                db,
                user=user,
                session=session,
                post=post,
                book=book,
                local_date=local,
                active_seconds=active_seconds,
                full_points=full_points,
                first_time_reader=first_time_reader,
                total_pages=data.total_pages,
                validation=check,
            )
            break
        except DuplicateKeyError as exc:
            # Sesi lain hari ini baru saja mendapat poin penuh → sesi ini tetap tercatat.
            if full_points and "one_full_points_session_per_day" in str(exc):
                full_points = False
                continue
            if "book_finished_once_per_user" in str(exc):
                raise AppError(
                    422, "book_already_finished", "Kamu sudah pernah menyelesaikan buku ini"
                ) from exc
            raise

    weekly = await target_service.award_weekly_target(db, user, local)
    if weekly:
        awards.append(weekly)
    await leaderboard_cache.invalidate_open(db)
    await social_service.notify_mentions(
        db, user, mentions, post["content"], f"/posts/{post['_id']}"
    )
    if data.rating is not None:
        avg = await posts.rating_stats(db, book["_id"])
        await books.update(db, book["_id"], {"$set": {"stats.avg_rating": avg}})

    updated_session = await sessions.get_owned(db, session_id, user["_id"])
    # Quest dulu (hadiahnya ikut terhitung di total poin), lalu badge.
    _, quests_completed = await quest_service.evaluate(db, user)
    badges = await badge_service.evaluate(db, user)
    quest_awards = [
        points_service.Award("quest_reward", f"Quest: {q.title}", q.reward_points)
        for q in quests_completed
        if q.reward_points
    ]
    return FinishOut(
        session=to_out(updated_session, cfg),
        post=(await post_service.enrich(db, [post], user["_id"]))[0],
        points=await points_result(db, user["_id"], points_before, awards + quest_awards, streak),
        badges=badges,
        quests_completed=quests_completed,
    )


async def points_result(
    db: AsyncDatabase,
    user_id: ObjectId,
    points_before: int,
    awards: list[points_service.Award],
    streak: streak_service.StreakUpdate,
) -> PointsResultOut:
    fresh = await db["users"].find_one({"_id": user_id}, {"stats": 1})
    total = int((fresh.get("stats") or {}).get("points_total", 0))
    level_before, _ = await points_service.level_for(db, points_before)
    level, upcoming = await points_service.level_for(db, total)
    if level:
        await db["users"].update_one({"_id": user_id}, {"$set": {"stats.level_id": level["_id"]}})
    return PointsResultOut(
        awarded=[AwardOut(rule_code=a.rule_code, name=a.name, points=a.points) for a in awards],
        total_awarded=sum(a.points for a in awards),
        points_total=total,
        level=points_service.level_out(level, upcoming),
        level_up=bool(level and (not level_before or level["level"] > level_before["level"])),
        streak=StreakOut(
            current=streak.current, longest=streak.longest, milestone=streak.milestone
        ),
    )


async def _commit_finish(
    db: AsyncDatabase,
    *,
    user: dict,
    session: dict,
    post: dict,
    book: dict,
    local_date: str,
    active_seconds: int,
    full_points: bool,
    first_time_reader: bool,
    total_pages: int | None,
    validation,
) -> tuple[list[points_service.Award], streak_service.StreakUpdate]:
    now = post["created_at"]
    async with db_module.get_client().start_session() as tx:
        async with await tx.start_transaction():
            post["_id"] = await posts.insert(db, post, session=tx)
            await sessions.set_fields(
                db,
                session["_id"],
                {
                    "status": "completed",
                    "ended_at": now,
                    "active_seconds": active_seconds,
                    "last_heartbeat_at": now,
                    "local_date": local_date,
                    "note_type": post["type"],
                    "post_id": post["_id"],
                    "is_full_points": full_points,
                    "page_progress": post["page_progress"],
                    "validation": {
                        "word_count": validation.word_count,
                        "unique_word_ratio": validation.unique_word_ratio,
                        "pasted_chars": validation.pasted_chars,
                        "passed": True,
                        "reasons": [],
                    },
                    "updated_at": now,
                },
                session=tx,
            )
            inc = {"stats.posts_count": 1}
            if post["is_book_finished"]:
                inc["stats.finished_count"] = 1
            if first_time_reader:
                inc["stats.readers_count"] = 1
            book_set: dict = {"updated_at": now}
            if total_pages and not book.get("total_pages"):
                book_set["total_pages"] = total_pages
            if not book.get("cover_image_key") and post["image_keys"]:
                book_set["cover_image_key"] = post["image_keys"][0]
            await books.update(db, book["_id"], {"$inc": inc, "$set": book_set}, session=tx)

            user_inc = {"stats.posts_count": 1}
            if post["is_book_finished"]:
                user_inc["stats.books_finished"] = 1
            await db["users"].update_one({"_id": post["author_id"]}, {"$inc": user_inc}, session=tx)
            await shelf_service.set_status(
                db,
                user["_id"],
                book["_id"],
                "finished" if post["is_book_finished"] else "reading",
                automatic=not post["is_book_finished"],
                session=tx,
            )
            return await _award_finish_points(
                db,
                user=user,
                session=session,
                post=post,
                local_date=local_date,
                full_points=full_points,
                tx=tx,
            )


async def _award_finish_points(
    db: AsyncDatabase,
    *,
    user: dict,
    session: dict,
    post: dict,
    local_date: str,
    full_points: bool,
    tx,
) -> tuple[list[points_service.Award], streak_service.StreakUpdate]:
    """Aturan poin saat sesi selesai (nilai & batas dari `point_rules`)."""
    awards: list[points_service.Award | None] = []

    async def give(rule_code: str, source_type: str, source_id: ObjectId) -> None:
        awards.append(
            await points_service.award(
                db,
                user=user,
                rule_code=rule_code,
                source_type=source_type,
                source_id=source_id,
                local_date=local_date,
                session=tx,
            )
        )

    if full_points:
        await give("session_valid", "reading_session", session["_id"])
        if post["type"] == "chapter_story":
            await give("chapter_story", "post", post["_id"])
        streak = await streak_service.record_read(db, user["_id"], local_date, session=tx)
        if streak.milestone:
            await give(f"streak_{streak.milestone}", "streak", session["_id"])
    else:
        if session.get("mode") == "micro":
            # Sesi kilat yang belum mencapai syarat harian tetap mendapat poin kecil.
            await give("micro_session", "reading_session", session["_id"])
        existing = await db["streaks"].find_one({"user_id": user["_id"]}, session=tx) or {}
        streak = streak_service.StreakUpdate(
            current=existing.get("current", 0), longest=existing.get("longest", 0), milestone=None
        )

    await give("post_feed", "post", post["_id"])
    if post["is_book_finished"]:
        await give("book_finished", "post", post["_id"])
    progress = post.get("page_progress") or {}
    if progress.get("current_page") and post["image_keys"]:
        await give("progress_photo", "post", post["_id"])
    return [a for a in awards if a], streak
