"""Target baca pengguna: harian (default) atau mingguan.

Target mingguan untuk pekerja yang jadwalnya tidak menentu: misalnya 75 menit per minggu,
boleh dikumpulkan di hari mana pun. Mencapainya memberi bonus `weekly_target` (sekali per
minggu, lewat ledger).
"""

import hashlib
from datetime import date, timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.repositories import catalog
from app.schemas.user import ProgressDayOut, ProgressOut
from app.services import points_service

DEFAULT_DAILY = 15
DEFAULT_WEEKLY = 75


def week_bounds(local_date: str) -> tuple[date, date]:
    """Senin–Minggu yang memuat `local_date`."""
    day = date.fromisoformat(local_date)
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


async def default_weekly(db: AsyncDatabase) -> int:
    return int(
        await catalog.get_setting(db, "onboarding.default_weekly_target_minutes", DEFAULT_WEEKLY)
    )


async def weekly_target(db: AsyncDatabase, user: dict) -> int:
    return int(user.get("weekly_target_minutes") or await default_weekly(db))


async def _seconds_by_day(
    db: AsyncDatabase, user_id: ObjectId, start: date, end: date
) -> dict[str, int]:
    rows = await (
        await db["reading_sessions"].aggregate(
            [
                {
                    "$match": {
                        "user_id": user_id,
                        "status": "completed",
                        "local_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
                    }
                },
                {"$group": {"_id": "$local_date", "s": {"$sum": "$active_seconds"}}},
            ]
        )
    ).to_list()
    return {r["_id"]: int(r["s"]) for r in rows}


def week_source_id(user_id: ObjectId, week_start: date) -> ObjectId:
    """ID sumber deterministik per (user, minggu) agar bonus idempoten di ledger."""
    digest = hashlib.sha256(f"weekly:{user_id}:{week_start.isoformat()}".encode()).digest()
    return ObjectId(digest[:12])


async def award_weekly_target(
    db: AsyncDatabase, user: dict, local_date: str
) -> points_service.Award | None:
    if user.get("target_mode") != "weekly":
        return None
    start, end = week_bounds(local_date)
    seconds = sum((await _seconds_by_day(db, user["_id"], start, end)).values())
    if seconds < await weekly_target(db, user) * 60:
        return None
    return await points_service.award(
        db,
        user=user,
        rule_code="weekly_target",
        source_type="week",
        source_id=week_source_id(user["_id"], start),
        local_date=local_date,
    )


async def progress(db: AsyncDatabase, user: dict) -> ProgressOut:
    today = clock.local_date(clock.now(), user.get("timezone", "Asia/Jakarta"))
    start, end = week_bounds(today)
    by_day = await _seconds_by_day(db, user["_id"], start, end)
    days = [(start + timedelta(days=i)).isoformat() for i in range(7)]
    daily_target = int(user.get("daily_target_minutes") or DEFAULT_DAILY)
    weekly = await weekly_target(db, user)
    today_minutes = by_day.get(today, 0) // 60
    week_minutes = sum(by_day.values()) // 60
    return ProgressOut(
        target_mode=user.get("target_mode", "daily"),
        daily_target_minutes=daily_target,
        weekly_target_minutes=weekly,
        today=today,
        today_minutes=today_minutes,
        week_minutes=week_minutes,
        week_start=start.isoformat(),
        week_end=end.isoformat(),
        daily_met=today_minutes >= daily_target,
        weekly_met=week_minutes >= weekly,
        days=[ProgressDayOut(date=d, minutes=by_day.get(d, 0) // 60) for d in days],
    )
