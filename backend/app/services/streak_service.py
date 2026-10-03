"""Streak harian: hari berturut-turut dengan sesi baca valid (menurut tanggal lokal user).

Streak freeze: tiap bulan pengguna punya jatah hari libur (`streak.freezes_per_month`). Hari
yang terlewat otomatis "dibekukan" saat pengguna membaca lagi, selama jatah bulan itu cukup,
sehingga lembur atau dinas tidak memutus streak. Hari beku tidak menambah hitungan streak.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import date, timedelta

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.repositories import catalog

MILESTONES = (7, 14, 30, 100)
DEFAULT_FREEZES_PER_MONTH = 2
KEEP_FREEZE_HISTORY = 120


@dataclass
class StreakUpdate:
    current: int
    longest: int
    milestone: int | None


def _yesterday(local_date: str) -> str:
    return (date.fromisoformat(local_date) - timedelta(days=1)).isoformat()


async def allowance(db: AsyncDatabase) -> int:
    return int(await catalog.get_setting(db, "streak.freezes_per_month", DEFAULT_FREEZES_PER_MONTH))


def missed_days(last_read: str, until: str) -> list[str]:
    """Tanggal setelah `last_read` sampai `until` (inklusif) — hari tanpa baca."""
    day = date.fromisoformat(last_read) + timedelta(days=1)
    end = date.fromisoformat(until)
    out = []
    while day <= end:
        out.append(day.isoformat())
        day += timedelta(days=1)
    return out


def can_freeze(streak: dict, missed: list[str], per_month: int) -> bool:
    """Apakah jatah freeze per bulan cukup untuk menutup semua hari yang terlewat."""
    if not missed or per_month <= 0:
        return False
    used = Counter(d[:7] for d in streak.get("freezes_used", []))
    used.update(d[:7] for d in missed)
    return all(used[month] <= per_month for month in {d[:7] for d in missed})


def effective_current(streak: dict | None, today_local: str, per_month: int = 0) -> int:
    """Streak yang masih hidup: terakhir membaca hari ini/kemarin, atau celahnya masih bisa
    ditutup dengan freeze."""
    if not streak or not streak.get("last_read_date"):
        return 0
    last = streak["last_read_date"]
    yesterday = _yesterday(today_local)
    if last in (today_local, yesterday):
        return streak.get("current", 0)
    if last < yesterday and can_freeze(streak, missed_days(last, yesterday), per_month):
        return streak.get("current", 0)
    return 0


def freezes_left(streak: dict | None, today_local: str, per_month: int) -> int:
    """Sisa freeze bulan ini, termasuk yang akan terpakai untuk celah saat ini."""
    month = today_local[:7]
    used = [d for d in (streak or {}).get("freezes_used", []) if d.startswith(month)]
    pending: list[str] = []
    if (
        streak
        and streak.get("last_read_date")
        and effective_current(streak, today_local, per_month)
    ):
        last = streak["last_read_date"]
        yesterday = _yesterday(today_local)
        if last < yesterday:
            pending = [d for d in missed_days(last, yesterday) if d.startswith(month)]
    return max(0, per_month - len(used) - len(pending))


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
    freezes_used: list[str] = list(streak.get("freezes_used", []))

    if last == local_date:
        return StreakUpdate(current, streak.get("longest", current), None)
    yesterday = _yesterday(local_date)
    missed = missed_days(last, yesterday) if last and last < yesterday else []
    if last == yesterday:
        current += 1
    elif missed and can_freeze(streak, missed, await allowance(db)):
        current += 1
        freezes_used = (freezes_used + missed)[-KEEP_FREEZE_HISTORY:]
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
                "freezes_used": freezes_used,
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
