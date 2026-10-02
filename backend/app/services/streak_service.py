"""Streak harian: hari berturut-turut dengan sesi baca valid (menurut tanggal lokal user)."""

from dataclasses import dataclass
from datetime import date, timedelta

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock

MILESTONES = (7, 14, 30, 100)


@dataclass
class StreakUpdate:
    current: int
    longest: int
    milestone: int | None


def _yesterday(local_date: str) -> str:
    return (date.fromisoformat(local_date) - timedelta(days=1)).isoformat()


def effective_current(streak: dict | None, today_local: str) -> int:
    """Streak yang masih hidup: terakhir membaca hari ini atau kemarin."""
    if not streak or not streak.get("last_read_date"):
        return 0
    if streak["last_read_date"] in (today_local, _yesterday(today_local)):
        return streak.get("current", 0)
    return 0


async def get(db: AsyncDatabase, user_id: ObjectId) -> dict | None:
    return await db["streaks"].find_one({"user_id": user_id})


async def record_read(
    db: AsyncDatabase,
    user_id: ObjectId,
    local_date: str,
    session: AsyncClientSession | None = None,
) -> StreakUpdate:
    streak = await db["streaks"].find_one({"user_id": user_id}, session=session) or {}
    last = streak.get("last_read_date")
    current = streak.get("current", 0)
    milestones_awarded: list[int] = list(streak.get("milestones_awarded", []))

    if last == local_date:
        return StreakUpdate(current, streak.get("longest", current), None)
    if last == _yesterday(local_date):
        current += 1
    else:
        current = 1
        milestones_awarded = []

    milestone = None
    if current in MILESTONES and current not in milestones_awarded:
        milestone = current
        milestones_awarded.append(current)

    longest = max(streak.get("longest", 0), current)
    await db["streaks"].find_one_and_update(
        {"user_id": user_id},
        {
            "$set": {
                "current": current,
                "longest": longest,
                "last_read_date": local_date,
                "milestones_awarded": milestones_awarded,
                "updated_at": clock.now(),
            },
            "$setOnInsert": {"freeze_tokens": 0},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    await db["users"].update_one(
        {"_id": user_id}, {"$set": {"stats.current_streak": current}}, session=session
    )
    return StreakUpdate(current, longest, milestone)
