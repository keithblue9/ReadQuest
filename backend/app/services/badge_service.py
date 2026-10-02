"""Badge data-driven: `badges.criteria = {type: <metrik user_stats>, gte: <angka>}`."""

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.schemas.gamification import BadgeOut
from app.services import notification_service, user_stats


def to_out(badge: dict, awarded_at=None, progress: int = 0) -> BadgeOut:
    criteria = badge.get("criteria") or {}
    return BadgeOut(
        id=badge["_id"],
        code=badge["code"],
        name=badge["name"],
        description=badge.get("description", ""),
        icon=badge.get("icon", "🏅"),
        earned=awarded_at is not None,
        awarded_at=awarded_at,
        progress=progress,
        target=int(criteria.get("gte", 0)),
    )


async def evaluate(db: AsyncDatabase, user: dict) -> list[BadgeOut]:
    """Berikan badge baru yang kriterianya sudah terpenuhi. Mengembalikan badge baru saja."""
    earned = {ub["badge_id"] async for ub in db["user_badges"].find({"user_id": user["_id"]})}
    pending = await db["badges"].find({"is_active": True, "_id": {"$nin": list(earned)}}).to_list()
    cache: dict[str, int] = {}
    new: list[BadgeOut] = []
    for badge in pending:
        criteria = badge.get("criteria") or {}
        metric = criteria.get("type")
        if metric not in user_stats.METRICS:
            continue
        if metric not in cache:
            cache[metric] = await user_stats.metric(db, user["_id"], metric)
        if cache[metric] < int(criteria.get("gte", 1)):
            continue
        now = clock.now()
        try:
            await db["user_badges"].insert_one(
                {"user_id": user["_id"], "badge_id": badge["_id"], "awarded_at": now}
            )
        except DuplicateKeyError:
            continue
        new.append(to_out(badge, now, cache[metric]))
        await notification_service.notify(
            db,
            user_id=user["_id"],
            type_="badge_awarded",
            context={
                "name": badge["name"],
                "icon": badge.get("icon", ""),
                "description": badge.get("description", ""),
            },
            url="/profile",
        )
    return new


async def list_for(db: AsyncDatabase, user: dict) -> list[BadgeOut]:
    earned = {
        ub["badge_id"]: ub["awarded_at"]
        async for ub in db["user_badges"].find({"user_id": user["_id"]})
    }
    badges = await db["badges"].find({"is_active": True}).sort("order", 1).to_list()
    cache: dict[str, int] = {}
    out = []
    for badge in badges:
        metric = (badge.get("criteria") or {}).get("type")
        if metric in user_stats.METRICS and metric not in cache:
            cache[metric] = await user_stats.metric(db, user["_id"], metric)
        out.append(to_out(badge, earned.get(badge["_id"]), cache.get(metric, 0)))
    out.sort(key=lambda b: (not b.earned, b.awarded_at is None, b.target))
    return out
