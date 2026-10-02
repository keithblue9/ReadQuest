"""Sistem poin berbasis ledger (append-only).

- Satu-satunya cara memberi/mengurangi poin adalah `award()` / `adjust()` yang menulis entri
  `points_ledger`; `users.stats.points_total` hanya cache yang bisa dihitung ulang.
- Nilai poin & batas harian dibaca dari `point_rules` (data-driven).
- Idempoten: unique index (user, rule, source_type, source_id) mencegah poin ganda.
"""

from dataclasses import dataclass

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.repositories import ledger
from app.schemas.points import (
    LedgerEntryOut,
    LedgerPageOut,
    LevelOut,
    PointsSummaryOut,
    StreakSummaryOut,
)


@dataclass
class Award:
    rule_code: str
    name: str
    points: int


async def get_rule(
    db: AsyncDatabase, code: str, session: AsyncClientSession | None = None
) -> dict | None:
    return await db["point_rules"].find_one({"code": code}, session=session)


async def award(
    db: AsyncDatabase,
    *,
    user: dict,
    rule_code: str,
    source_type: str,
    source_id: ObjectId | None,
    local_date: str,
    actor_id: ObjectId | None = None,
    session: AsyncClientSession | None = None,
) -> Award | None:
    """Beri poin sesuai aturan. Mengembalikan None bila aturan nonaktif, batas harian
    tercapai, atau poin untuk sumber ini sudah pernah diberikan."""
    rule = await get_rule(db, rule_code, session=session)
    if rule is None or not rule.get("is_active", True) or rule["points"] == 0:
        return None

    cap_count = rule.get("daily_cap_count")
    cap_points = rule.get("daily_cap_points")
    if cap_count is not None or cap_points is not None:
        count, points_today = await ledger.daily_usage(
            db, user["_id"], local_date, rule_code, session=session
        )
        if cap_count is not None and count >= cap_count:
            return None
        if cap_points is not None and points_today + rule["points"] > cap_points:
            return None

    if await ledger.exists(db, user["_id"], rule_code, source_type, source_id, session=session):
        return None

    now = clock.now()
    try:
        await ledger.insert(
            db,
            {
                "user_id": user["_id"],
                "function_id": user.get("function_id"),
                "rule_code": rule_code,
                "points": rule["points"],
                "source_type": source_type,
                "source_id": source_id,
                "actor_id": actor_id,
                "local_date": local_date,
                "reverses_id": None,
                "note": None,
                "created_at": now,
            },
            session=session,
        )
    except DuplicateKeyError:
        return None
    await db["users"].update_one(
        {"_id": user["_id"]}, {"$inc": {"stats.points_total": rule["points"]}}, session=session
    )
    return Award(rule_code=rule_code, name=rule["name"], points=rule["points"])


async def adjust(
    db: AsyncDatabase,
    *,
    user: dict,
    points: int,
    note: str,
    actor_id: ObjectId,
    reverses_id: ObjectId | None = None,
) -> None:
    """Koreksi manual oleh Admin: entri baru, bukan mengubah entri lama."""
    now = clock.now()
    await ledger.insert(
        db,
        {
            "user_id": user["_id"],
            "function_id": user.get("function_id"),
            "rule_code": "reversal" if reverses_id else "adjustment",
            "points": points,
            "source_type": "adjustment",
            "source_id": ObjectId(),
            "actor_id": actor_id,
            "local_date": clock.local_date(now, user.get("timezone", "Asia/Jakarta")),
            "reverses_id": reverses_id,
            "note": note,
            "created_at": now,
        },
    )
    await db["users"].update_one({"_id": user["_id"]}, {"$inc": {"stats.points_total": points}})


async def recompute_total(db: AsyncDatabase, user_id: ObjectId) -> int:
    """Hitung ulang cache saldo dari ledger (rekonsiliasi)."""
    total = await ledger.total_for_user(db, user_id)
    await db["users"].update_one({"_id": user_id}, {"$set": {"stats.points_total": total}})
    return total


async def level_for(db: AsyncDatabase, points: int) -> tuple[dict | None, dict | None]:
    """(level saat ini, level berikutnya) berdasarkan koleksi `levels`."""
    current = await db["levels"].find_one(
        {"min_points": {"$lte": points}}, sort=[("min_points", -1)]
    )
    upcoming = await db["levels"].find_one(
        {"min_points": {"$gt": points}}, sort=[("min_points", 1)]
    )
    return current, upcoming


def level_out(level: dict | None, upcoming: dict | None) -> LevelOut | None:
    if not level:
        return None
    return LevelOut(
        level=level["level"],
        title=level["title"],
        min_points=level["min_points"],
        next_min_points=upcoming["min_points"] if upcoming else None,
        next_title=upcoming["title"] if upcoming else None,
    )


async def summary(db: AsyncDatabase, user: dict) -> PointsSummaryOut:
    from app.services import streak_service

    today = clock.local_date(clock.now(), user.get("timezone", "Asia/Jakarta"))
    total = int((user.get("stats") or {}).get("points_total", 0))
    level, upcoming = await level_for(db, total)
    streak = await streak_service.get(db, user["_id"])
    current = streak_service.effective_current(streak, today)
    next_milestone = next((m for m in streak_service.MILESTONES if m > current), None)
    return PointsSummaryOut(
        points_total=total,
        points_today=await ledger.sum_on_date(db, user["_id"], today),
        level=level_out(level, upcoming),
        streak=StreakSummaryOut(
            current=current,
            longest=(streak or {}).get("longest", 0),
            last_read_date=(streak or {}).get("last_read_date"),
            read_today=(streak or {}).get("last_read_date") == today,
            next_milestone=next_milestone,
        ),
    )


async def history(
    db: AsyncDatabase, user_id: ObjectId, cursor: str | None, limit: int
) -> LedgerPageOut:
    from app.services.post_service import decode_cursor, encode_cursor

    rows = await ledger.page_for_user(db, user_id, decode_cursor(cursor), limit + 1)
    has_more = len(rows) > limit
    rows = rows[:limit]
    names = {r["code"]: r["name"] async for r in db["point_rules"].find({}, {"code": 1, "name": 1})}
    names.update({"adjustment": "Penyesuaian admin", "reversal": "Pembatalan poin"})
    return LedgerPageOut(
        items=[
            LedgerEntryOut(
                id=r["_id"],
                rule_code=r["rule_code"],
                name=names.get(r["rule_code"], r["rule_code"]),
                points=r["points"],
                source_type=r["source_type"],
                local_date=r["local_date"],
                note=r.get("note"),
                created_at=r["created_at"],
            )
            for r in rows
        ],
        next_cursor=encode_cursor(rows[-1]) if has_more and rows else None,
    )
