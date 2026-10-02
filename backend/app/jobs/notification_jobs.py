"""Job notifikasi terjadwal. Waktu & hari diatur lewat `app_settings.notifications.schedule`."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.repositories import catalog, sessions
from app.services import (
    authenticity_service,
    leaderboard_service,
    notification_service,
    quest_service,
    streak_service,
)
from app.services.leaderboard_service import period_window

WINDOW = timedelta(minutes=15)
DEFAULT_SCHEDULE = {
    "streak_risk_time": "20:00",
    "weekly_leaderboard": {"weekday": 0, "time": "09:00"},
    "new_quest": {"weekday": 0, "time": "08:00"},
    "authenticity_time": "07:00",
}
CATEGORY_LABELS = {
    "top_storyteller": "Top Storyteller",
    "streak_master": "Streak Master",
    "book_finisher": "Book Finisher",
    "most_inspiring": "Most Inspiring",
    "function_battle": "Battle Fungsi",
}


async def _schedule(db: AsyncDatabase) -> dict:
    return {
        **DEFAULT_SCHEDULE,
        **(await catalog.get_setting(db, "notifications.schedule", {}) or {}),
    }


async def _team_tz(db: AsyncDatabase) -> str:
    return str(await catalog.get_setting(db, "team.timezone", "Asia/Jakarta"))


def _in_window(local: datetime, hhmm: str) -> bool:
    hours, minutes = (int(x) for x in hhmm.split(":"))
    start = local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    return start <= local < start + WINDOW


async def _once(db: AsyncDatabase, key: str) -> bool:
    """True bila job dengan kunci ini belum pernah berjalan (lalu ditandai sudah)."""
    try:
        await db["scheduled_runs"].insert_one({"_id": key, "ran_at": clock.now()})
        return True
    except DuplicateKeyError:
        return False


async def _already_notified(db: AsyncDatabase, user_id, group_key: str) -> bool:
    return (
        await db["notifications"].find_one({"user_id": user_id, "group_key": group_key}) is not None
    )


async def reading_reminders(db: AsyncDatabase) -> int:
    """Pengingat baca pada `reminder_time` user bila belum ada sesi poin penuh hari itu."""
    now = clock.now()
    sent = 0
    async for user in db["users"].find(
        {"status": "active", "onboarding_completed_at": {"$ne": None}}
    ):
        prefs = await notification_service.get_preferences(db, user["_id"])
        local = now.astimezone(ZoneInfo(user.get("timezone", "Asia/Jakarta")))
        if not _in_window(local, prefs.reminder_time):
            continue
        today = local.date().isoformat()
        key = f"reading_reminder:{today}"
        if await _already_notified(db, user["_id"], key):
            continue
        if await sessions.has_full_points_on(db, user["_id"], today):
            continue
        await notification_service.notify(
            db,
            user_id=user["_id"],
            type_="reading_reminder",
            context={"minutes": user.get("daily_target_minutes", 15)},
            url="/read",
            group_key=key,
        )
        sent += 1
    return sent


async def streak_at_risk(db: AsyncDatabase) -> int:
    schedule = await _schedule(db)
    now = clock.now()
    sent = 0
    async for streak in db["streaks"].find({"current": {"$gte": 1}}):
        user = await db["users"].find_one({"_id": streak["user_id"], "status": "active"})
        if not user:
            continue
        local = now.astimezone(ZoneInfo(user.get("timezone", "Asia/Jakarta")))
        if not _in_window(local, schedule["streak_risk_time"]):
            continue
        today = local.date().isoformat()
        current = streak_service.effective_current(streak, today)
        if current < 1 or streak.get("last_read_date") == today:
            continue
        key = f"streak_at_risk:{today}"
        if await _already_notified(db, user["_id"], key):
            continue
        await notification_service.notify(
            db,
            user_id=user["_id"],
            type_="streak_at_risk",
            context={"streak": current},
            url="/read",
            group_key=key,
        )
        sent += 1
    return sent


def _team_due(local: datetime, spec: dict) -> bool:
    return local.weekday() == int(spec.get("weekday", 0)) and _in_window(local, spec["time"])


async def weekly_leaderboard(db: AsyncDatabase) -> int:
    schedule = await _schedule(db)
    tz = await _team_tz(db)
    now = clock.now()
    local = now.astimezone(ZoneInfo(tz))
    if not _team_due(local, schedule["weekly_leaderboard"]):
        return 0
    last_week = period_window("weekly", tz, None, now - timedelta(days=7))
    if not await _once(db, f"weekly_leaderboard:{last_week.key}"):
        return 0
    sent = 0
    async for user in db["users"].find({"status": "active"}):
        ranks = []
        for category, label in CATEGORY_LABELS.items():
            if category == "function_battle":
                continue
            board = await leaderboard_service.leaderboard(
                db, user, category, "weekly", last_week.key
            )
            if board.me:
                ranks.append((board.me.rank, label))
        ranks.sort()
        summary = (
            ", ".join(f"#{rank} {label}" for rank, label in ranks[:3])
            if ranks
            else "Belum masuk peringkat — minggu ini kesempatanmu!"
        )
        await notification_service.notify(
            db,
            user_id=user["_id"],
            type_="weekly_leaderboard",
            context={"summary": summary},
            url=f"/leaderboard?key={last_week.key}",
            group_key=f"weekly_leaderboard:{last_week.key}",
        )
        sent += 1
    return sent


async def new_quests(db: AsyncDatabase) -> int:
    schedule = await _schedule(db)
    tz = await _team_tz(db)
    now = clock.now()
    local = now.astimezone(ZoneInfo(tz))
    if not _team_due(local, schedule["new_quest"]):
        return 0
    week = period_window("weekly", tz, None, now)
    if not await _once(db, f"new_quest:{week.key}"):
        return 0
    count = len(await quest_service.active_quests(db))
    if not count:
        return 0
    sent = 0
    async for user in db["users"].find({"status": "active"}, {"_id": 1}):
        await notification_service.notify(
            db,
            user_id=user["_id"],
            type_="new_quest",
            context={"count": count},
            url="/quests",
            group_key=f"new_quest:{week.key}",
        )
        sent += 1
    return sent


async def daily_authenticity(db: AsyncDatabase) -> int:
    schedule = await _schedule(db)
    tz = await _team_tz(db)
    local = clock.now().astimezone(ZoneInfo(tz))
    if not _in_window(local, schedule["authenticity_time"]):
        return 0
    if not await _once(db, f"authenticity:{local.date().isoformat()}"):
        return 0
    return (await authenticity_service.run_daily(db))["nudged"]
