"""Quest (mis. weekly quest). Progres dihitung dari data aktivitas dalam jendela quest, sehingga
selalu konsisten; hadiah poin dicatat di ledger sekali per user per periode."""

from datetime import datetime

from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.repositories import catalog
from app.schemas.gamification import QuestOut
from app.services import notification_service, points_service, user_stats
from app.services.leaderboard_service import period_window


async def _window(db: AsyncDatabase, quest: dict) -> tuple[str, datetime | None, datetime | None]:
    if quest.get("recurring"):
        tz = str(await catalog.get_setting(db, "team.timezone", "Asia/Jakarta"))
        window = period_window(quest.get("period", "weekly"), tz, None, clock.now())
        return window.key, window.start, window.end
    key = str(quest["_id"])
    return key, quest.get("starts_at"), quest.get("ends_at")


async def active_quests(db: AsyncDatabase) -> list[dict]:
    now = clock.now()
    return (
        await db["quests"]
        .find(
            {
                "is_active": True,
                "$or": [
                    {"recurring": True},
                    {"starts_at": {"$lte": now}, "ends_at": {"$gt": now}},
                ],
            }
        )
        .sort("order", 1)
        .to_list()
    )


async def evaluate(db: AsyncDatabase, user: dict) -> tuple[list[QuestOut], list[QuestOut]]:
    """(semua quest aktif dengan progres, quest yang baru saja selesai)."""
    out, completed_now = [], []
    for quest in await active_quests(db):
        key, start, end = await _window(db, quest)
        goal = quest.get("goal") or {}
        target = int(goal.get("target", 1))
        metric = goal.get("type")
        progress = (
            await user_stats.metric(db, user["_id"], metric, since=start, until=end)
            if metric in user_stats.METRICS
            else 0
        )
        now = clock.now()
        doc = await db["user_quests"].find_one_and_update(
            {"user_id": user["_id"], "quest_id": quest["_id"], "period_key": key},
            {
                "$set": {"progress": progress, "updated_at": now},
                "$setOnInsert": {"completed_at": None, "rewarded_at": None},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        reward_points = int((quest.get("reward") or {}).get("points", 0))
        item = QuestOut(
            id=quest["_id"],
            code=quest["code"],
            title=quest["title"],
            description=quest.get("description", ""),
            goal_type=metric or "",
            target=target,
            progress=min(progress, target),
            completed=progress >= target,
            reward_points=reward_points,
            period_key=key,
            ends_at=end,
        )
        if progress >= target and doc.get("completed_at") is None:
            claimed = await db["user_quests"].find_one_and_update(
                {"_id": doc["_id"], "completed_at": None},
                {"$set": {"completed_at": now, "rewarded_at": now if reward_points else None}},
            )
            if claimed:
                if reward_points:
                    await points_service.award_amount(
                        db,
                        user=user,
                        points=reward_points,
                        rule_code="quest_reward",
                        source_type="quest",
                        source_id=doc["_id"],
                    )
                await notification_service.create(
                    db,
                    user_id=user["_id"],
                    type_="quest_completed",
                    title=f"Quest selesai: {quest['title']} 🎯",
                    body=f"+{reward_points} poin" if reward_points else "Kerja bagus!",
                    data={"url": "/quests"},
                )
                completed_now.append(item)
        out.append(item)
    return out, completed_now
