"""Leaderboard: agregasi dari ledger, posting, reaksi, dan sesi baca per periode.

Periode dihitung menurut zona waktu tim (`team.timezone`). Hasil lengkap (semua peserta)
disimpan di `leaderboard_snapshots` selama `leaderboard.cache_seconds`; periode yang sudah
lewat dibekukan (`is_final`).
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.repositories import catalog
from app.schemas.leaderboard import (
    FunctionRefOut,
    LeaderboardEntryOut,
    LeaderboardOut,
    LeaderboardSummaryItemOut,
    MyRankOut,
)
from app.schemas.posts import UserMiniOut
from app.services.note_validation import NOTE_TYPES as ALL_NOTE_TYPES

NOTE_TYPES = list(ALL_NOTE_TYPES)
USER_CATEGORIES = ["top_storyteller", "streak_master", "book_finisher", "most_inspiring"]
TOP_N = 50
MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


@dataclass
class PeriodWindow:
    key: str
    label: str
    start_date: str | None  # inklusif, YYYY-MM-DD
    end_date: str | None  # eksklusif
    start: datetime | None
    end: datetime | None


def _fmt(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]}"


def period_window(period: str, tz: str, key: str | None, now: datetime) -> PeriodWindow:
    zone = ZoneInfo(tz)
    today = now.astimezone(zone).date()
    if period == "all_time":
        return PeriodWindow("all", "Sepanjang masa", None, None, None, None)
    try:
        if period == "weekly":
            if key:
                year, week = key.split("-W")
                start = date.fromisocalendar(int(year), int(week), 1)
            else:
                start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=7)
            iso = start.isocalendar()
            key = f"{iso.year}-W{iso.week:02d}"
            label = (
                f"{_fmt(start)} – {_fmt(end - timedelta(days=1))} {(end - timedelta(days=1)).year}"
            )
        elif period == "monthly":
            if key:
                y, m = key.split("-")
                start = date(int(y), int(m), 1)
            else:
                start = today.replace(day=1)
            end = (start + timedelta(days=32)).replace(day=1)
            key = f"{start.year}-{start.month:02d}"
            label = f"{MONTHS[start.month - 1]} {start.year}"
        else:
            raise ValueError(period)
    except ValueError as exc:
        raise AppError(422, "invalid_period", "Periode tidak valid") from exc
    to_utc = lambda d: datetime.combine(d, time.min, zone)  # noqa: E731
    return PeriodWindow(key, label, start.isoformat(), end.isoformat(), to_utc(start), to_utc(end))


def _range(field: str, window: PeriodWindow, as_dates: bool = False) -> dict:
    if window.start is None:
        return {}
    if as_dates:
        return {field: {"$gte": window.start_date, "$lt": window.end_date}}
    return {field: {"$gte": window.start, "$lt": window.end}}


VISIBLE_POSTS = {"deleted_at": None, "moderation.status": {"$ne": "hidden"}}


async def _aggregate(db: AsyncDatabase, collection: str, pipeline: list) -> list[dict]:
    return await (await db[collection].aggregate(pipeline)).to_list()


async def _scores(db: AsyncDatabase, category: str, window: PeriodWindow) -> list[dict]:
    """Baris {id, score, detail} belum diurutkan."""
    if category == "top_storyteller":
        rows = await _aggregate(
            db,
            "posts",
            [
                {
                    "$match": {
                        "type": {"$in": NOTE_TYPES},
                        **VISIBLE_POSTS,
                        **_range("created_at", window),
                    }
                },
                {
                    "$group": {
                        "_id": "$author_id",
                        "notes": {"$sum": 1},
                        "words": {"$sum": "$word_count"},
                    }
                },
            ],
        )
        return [
            {
                "id": r["_id"],
                "score": r["notes"],
                "tiebreak": r["words"],
                "detail": {"words": r["words"]},
            }
            for r in rows
        ]

    if category == "book_finisher":
        rows = await _aggregate(
            db,
            "posts",
            [
                {
                    "$match": {
                        "is_book_finished": True,
                        **VISIBLE_POSTS,
                        **_range("created_at", window),
                    }
                },
                {"$group": {"_id": "$author_id", "books": {"$sum": 1}}},
            ],
        )
        return [{"id": r["_id"], "score": r["books"], "tiebreak": 0, "detail": {}} for r in rows]

    if category == "most_inspiring":
        rows = await _aggregate(
            db,
            "reactions",
            [
                {
                    "$match": {
                        "type": {"$ne": None},
                        "$expr": {"$ne": ["$user_id", "$post_author_id"]},
                        **_range("created_at", window),
                    }
                },
                {
                    "$group": {
                        "_id": "$post_author_id",
                        "total": {"$sum": 1},
                        "inspiring": {"$sum": {"$cond": [{"$eq": ["$type", "inspiring"]}, 1, 0]}},
                    }
                },
            ],
        )
        return [
            {
                "id": r["_id"],
                "score": r["total"],
                "tiebreak": r["inspiring"],
                "detail": {"inspiring": r["inspiring"]},
            }
            for r in rows
        ]

    if category == "streak_master":
        if window.start is None:
            rows = await db["streaks"].find({"longest": {"$gt": 0}}).to_list()
            return [
                {
                    "id": r["user_id"],
                    "score": r["longest"],
                    "tiebreak": r.get("current", 0),
                    "detail": {},
                }
                for r in rows
            ]
        rows = await _aggregate(
            db,
            "reading_sessions",
            [
                {"$match": {"status": "completed", **_range("local_date", window, as_dates=True)}},
                {
                    "$group": {
                        "_id": "$user_id",
                        "days": {"$addToSet": "$local_date"},
                        "seconds": {"$sum": "$active_seconds"},
                    }
                },
            ],
        )
        return [
            {
                "id": r["_id"],
                "score": len(r["days"]),
                "tiebreak": r["seconds"],
                "detail": {"minutes": round(r["seconds"] / 60)},
            }
            for r in rows
        ]

    if category == "function_battle":
        points = await _aggregate(
            db,
            "points_ledger",
            [
                {
                    "$match": {
                        "function_id": {"$ne": None},
                        **_range("local_date", window, as_dates=True),
                    }
                },
                {"$group": {"_id": "$function_id", "points": {"$sum": "$points"}}},
            ],
        )
        totals = {r["_id"]: r["points"] for r in points}
        members = await _aggregate(
            db,
            "users",
            [
                {"$match": {"status": "active", "function_id": {"$ne": None}}},
                {"$group": {"_id": "$function_id", "members": {"$sum": 1}}},
            ],
        )
        active_functions = {
            f["_id"] async for f in db["functions"].find({"is_active": True}, {"_id": 1})
        }
        rows = []
        for m in members:
            if m["_id"] not in active_functions:
                continue
            total = totals.get(m["_id"], 0)
            rows.append(
                {
                    "id": m["_id"],
                    "score": round(total / m["members"], 1),
                    "tiebreak": total,
                    "detail": {"total_points": total, "members": m["members"]},
                }
            )
        return rows

    raise AppError(422, "invalid_category", "Kategori tidak valid")


def _rank(rows: list[dict]) -> list[dict]:
    rows = [r for r in rows if r["score"] > 0]
    rows.sort(key=lambda r: (-r["score"], -r["tiebreak"], str(r["id"])))
    ranked, previous, rank = [], None, 0
    for index, row in enumerate(rows, start=1):
        key = (row["score"], row["tiebreak"])
        if key != previous:
            rank, previous = index, key
        ranked.append({**row, "rank": rank})
    return ranked


async def _ranking(
    db: AsyncDatabase, category: str, period: str, window: PeriodWindow
) -> tuple[list[dict], datetime, bool]:
    """Ranking lengkap (semua peserta) dengan cache di leaderboard_snapshots."""
    now = clock.now()
    cache_seconds = int(await catalog.get_setting(db, "leaderboard.cache_seconds", 300))
    snapshot = await db["leaderboard_snapshots"].find_one(
        {"category": category, "period": period, "period_key": window.key}
    )
    if snapshot and (
        snapshot.get("is_final") or (now - snapshot["computed_at"]).total_seconds() < cache_seconds
    ):
        return snapshot["ranking"], snapshot["computed_at"], snapshot.get("is_final", False)

    ranking = _rank(await _scores(db, category, window))
    is_final = window.end is not None and now >= window.end
    stored = [
        {"id": r["id"], "rank": r["rank"], "score": r["score"], "detail": r["detail"]}
        for r in ranking
    ]
    await db["leaderboard_snapshots"].update_one(
        {"category": category, "period": period, "period_key": window.key},
        {
            "$set": {
                "ranking": stored,
                "is_final": is_final,
                "computed_at": now,
                "entries": stored[:TOP_N],
            }
        },
        upsert=True,
    )
    return stored, now, is_final


async def _team_tz(db: AsyncDatabase) -> str:
    return str(await catalog.get_setting(db, "team.timezone", "Asia/Jakarta"))


def _neighbours(
    period: str, tz: str, window: PeriodWindow, now: datetime
) -> tuple[str | None, str | None]:
    """Kunci periode sebelum/sesudah (sesudah hanya bila tidak melewati periode berjalan)."""
    if window.start_date is None:
        return None, None
    start = date.fromisoformat(window.start_date)
    end = date.fromisoformat(window.end_date)
    previous_start = (
        start - timedelta(days=7)
        if period == "weekly"
        else (start - timedelta(days=1)).replace(day=1)
    )
    prev_key = period_window(period, tz, _key_for(period, previous_start), now).key
    current = period_window(period, tz, None, now)
    next_key = None
    if window.key != current.key:
        next_key = period_window(period, tz, _key_for(period, end), now).key
    return prev_key, next_key


def _key_for(period: str, day: date) -> str:
    if period == "weekly":
        iso = day.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    return f"{day.year}-{day.month:02d}"


async def leaderboard(
    db: AsyncDatabase, user: dict, category: str, period: str, period_key: str | None
) -> LeaderboardOut:
    tz = await _team_tz(db)
    now = clock.now()
    window = period_window(period, tz, period_key, now)
    current = period_window(period, tz, None, now)
    if window.start is not None and current.start is not None and window.start > current.start:
        raise AppError(422, "invalid_period", "Periode belum dimulai")
    prev_key, next_key = _neighbours(period, tz, window, now)
    ranking, computed_at, is_final = await _ranking(db, category, period, window)
    top = ranking[:TOP_N]

    entries: list[LeaderboardEntryOut] = []
    if category == "function_battle":
        names = {
            f["_id"]: f["name"]
            async for f in db["functions"].find({"_id": {"$in": [r["id"] for r in top]}})
        }
        for r in top:
            entries.append(
                LeaderboardEntryOut(
                    rank=r["rank"],
                    score=r["score"],
                    function=FunctionRefOut(id=r["id"], name=names.get(r["id"], "—")),
                    detail=r["detail"],
                )
            )
        mine = next((r for r in ranking if r["id"] == user.get("function_id")), None)
    else:
        users = {
            u["_id"]: u
            async for u in db["users"].find(
                {"_id": {"$in": [r["id"] for r in top]}}, {"name": 1, "avatar_url": 1}
            )
        }
        for r in top:
            u = users.get(r["id"])
            if not u:
                continue
            entries.append(
                LeaderboardEntryOut(
                    rank=r["rank"],
                    score=r["score"],
                    user=UserMiniOut(id=u["_id"], name=u["name"], avatar_url=u.get("avatar_url")),
                    detail=r["detail"],
                )
            )
        mine = next((r for r in ranking if r["id"] == user["_id"]), None)

    return LeaderboardOut(
        category=category,
        period=period,
        period_key=window.key,
        label=window.label,
        is_final=is_final,
        prev_key=prev_key,
        next_key=next_key,
        entries=entries,
        me=MyRankOut(rank=mine["rank"], score=mine["score"], total_participants=len(ranking))
        if mine
        else None,
        computed_at=computed_at,
    )


async def my_summary(db: AsyncDatabase, user: dict, period: str) -> list[LeaderboardSummaryItemOut]:
    window = period_window(period, await _team_tz(db), None, clock.now())
    out = []
    for category in [*USER_CATEGORIES, "function_battle"]:
        ranking, _, _ = await _ranking(db, category, period, window)
        target: ObjectId | None = (
            user.get("function_id") if category == "function_battle" else user["_id"]
        )
        mine = next((r for r in ranking if r["id"] == target), None)
        out.append(
            LeaderboardSummaryItemOut(
                category=category,
                rank=mine["rank"] if mine else None,
                score=mine["score"] if mine else 0,
                total_participants=len(ranking),
            )
        )
    return out
