"""Reading Authenticity Index.

Contribution Ratio (jendela 30 hari) = catatan sendiri / (catatan + komentar diberikan + like
diberikan). Status ditentukan ambang di `app_settings.authenticity.thresholds`:

- Active Reader : ratio >= active_reader
- Warming Up    : ratio >= warming_up
- Observer      : ada aktivitas tetapi ratio di bawah ambang (lebih banyak mengamati)
- Silent        : tidak ada aktivitas sama sekali

Status hanya boleh dilihat oleh user yang bersangkutan, Team Lead fungsinya, dan Admin.
"""

from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError, forbidden
from app.repositories import catalog
from app.schemas.authenticity import AuthenticityOut, AuthenticityTeamOut
from app.services import notification_service, permissions

WINDOW_DAYS = 30
NOTE_TYPES = ["quick_note", "chapter_story", "book_review"]
LABELS = {
    "active_reader": "Active Reader",
    "warming_up": "Warming Up",
    "observer": "Observer",
    "silent": "Silent",
}
DEFAULT_THRESHOLDS = {"active_reader": 0.5, "warming_up": 0.25, "observer": 0.0}
NUDGE_COOLDOWN = timedelta(days=7)


def classify(own_notes: int, comments: int, likes: int, thresholds: dict) -> tuple[float, str]:
    total = own_notes + comments + likes
    if total == 0:
        return 0.0, "silent"
    ratio = own_notes / total
    if ratio >= float(thresholds.get("active_reader", 0.5)):
        return ratio, "active_reader"
    if ratio >= float(thresholds.get("warming_up", 0.25)):
        return ratio, "warming_up"
    return ratio, "observer"


async def _counts(db: AsyncDatabase, user_ids: list[ObjectId], since) -> dict[ObjectId, dict]:
    result = {uid: {"notes": 0, "comments": 0, "likes": 0} for uid in user_ids}

    async def tally(collection: str, match: dict, field: str, key: str) -> None:
        pipeline = [
            {"$match": {field: {"$in": user_ids}, "created_at": {"$gte": since}, **match}},
            {"$group": {"_id": f"${field}", "n": {"$sum": 1}}},
        ]
        async for row in await db[collection].aggregate(pipeline):
            result[row["_id"]][key] = row["n"]

    await tally("posts", {"type": {"$in": NOTE_TYPES}, "deleted_at": None}, "author_id", "notes")
    await tally("comments", {"deleted_at": None}, "author_id", "comments")
    await tally("reactions", {"type": {"$ne": None}}, "user_id", "likes")
    return result


async def compute(db: AsyncDatabase, users: list[dict]) -> list[AuthenticityOut]:
    now = clock.now()
    thresholds = await catalog.get_setting(db, "authenticity.thresholds", DEFAULT_THRESHOLDS)
    counts = await _counts(db, [u["_id"] for u in users], now - timedelta(days=WINDOW_DAYS))
    out = []
    for user in users:
        c = counts[user["_id"]]
        ratio, status = classify(c["notes"], c["comments"], c["likes"], thresholds)
        out.append(
            AuthenticityOut(
                user_id=user["_id"],
                name=user["name"],
                function_id=user.get("function_id"),
                window_days=WINDOW_DAYS,
                own_notes=c["notes"],
                comments_given=c["comments"],
                likes_given=c["likes"],
                contribution_ratio=round(ratio, 3),
                status=status,
                status_label=LABELS[status],
                computed_at=now,
            )
        )
    return out


async def _has_permission(db: AsyncDatabase, user: dict, code: str) -> bool:
    role = await permissions.get_role(db, user["role_id"])
    return bool(role and code in role.get("permission_codes", []))


async def led_function_ids(db: AsyncDatabase, user: dict) -> list[ObjectId]:
    """Fungsi yang dipimpin: fungsi yang mencantumkan user di lead_user_ids beserta seluruh
    sub-fungsinya; bila tidak ada, fungsi user sendiri (untuk role Team Lead)."""
    led = [f["_id"] async for f in db["functions"].find({"lead_user_ids": user["_id"]}, {"_id": 1})]
    if not led and user.get("function_id"):
        led = [user["function_id"]]
    if not led:
        return []
    children = [
        f["_id"] async for f in db["functions"].find({"ancestors": {"$in": led}}, {"_id": 1})
    ]
    return list(dict.fromkeys([*led, *children]))


async def can_view(db: AsyncDatabase, viewer: dict, target: dict) -> bool:
    if viewer["_id"] == target["_id"]:
        return await _has_permission(db, viewer, "authenticity.view_self")
    if await _has_permission(db, viewer, "authenticity.view_all"):
        return True
    if await _has_permission(db, viewer, "authenticity.view_team"):
        return target.get("function_id") in await led_function_ids(db, viewer)
    return False


async def for_user(db: AsyncDatabase, viewer: dict, target_id: ObjectId) -> AuthenticityOut:
    target = await db["users"].find_one({"_id": target_id})
    if target is None:
        raise AppError(404, "user_not_found", "Pengguna tidak ditemukan")
    if not await can_view(db, viewer, target):
        raise forbidden("Status Authenticity Index hanya untuk ybs, Team Lead, dan Admin")
    return (await compute(db, [target]))[0]


async def team(
    db: AsyncDatabase, viewer: dict, function_id: ObjectId | None
) -> AuthenticityTeamOut:
    if await _has_permission(db, viewer, "authenticity.view_all"):
        scope = [function_id] if function_id else None
    elif await _has_permission(db, viewer, "authenticity.view_team"):
        led = await led_function_ids(db, viewer)
        if function_id and function_id not in led:
            raise forbidden("Kamu hanya dapat melihat fungsi yang kamu pimpin")
        scope = [function_id] if function_id else led
    else:
        raise forbidden()

    query: dict = {"status": "active"}
    if scope is not None:
        query["function_id"] = {"$in": scope}
    users = await db["users"].find(query, {"name": 1, "function_id": 1}).sort("name", 1).to_list()
    members = await compute(db, users)
    counts = {s: 0 for s in LABELS}
    for m in members:
        counts[m.status] += 1
    order = {"silent": 0, "observer": 1, "warming_up": 2, "active_reader": 3}
    members.sort(key=lambda m: (order[m.status], m.contribution_ratio, m.name))
    return AuthenticityTeamOut(counts=counts, members=members)


async def run_daily(db: AsyncDatabase) -> dict[str, int]:
    """Job harian: simpan snapshot semua user aktif & kirim nudge lembut ke Observer."""
    users = await db["users"].find({"status": "active"}).to_list()
    results = await compute(db, users)
    by_id = {u["_id"]: u for u in users}
    now = clock.now()
    nudged = 0
    for r in results:
        user = by_id[r.user_id]
        local = clock.local_date(now, user.get("timezone", "Asia/Jakarta"))
        previous = await db["authenticity_snapshots"].find_one(
            {"user_id": r.user_id, "nudged_at": {"$ne": None}}, sort=[("nudged_at", -1)]
        )
        nudge = r.status == "observer" and (
            previous is None or now - previous["nudged_at"] >= NUDGE_COOLDOWN
        )
        fields = {
            "function_id": r.function_id,
            "window_days": r.window_days,
            "own_notes": r.own_notes,
            "comments_given": r.comments_given,
            "likes_given": r.likes_given,
            "contribution_ratio": r.contribution_ratio,
            "status": r.status,
            "created_at": now,
        }
        update: dict = {"$set": fields}
        if nudge:
            fields["nudged_at"] = now
        else:
            update["$setOnInsert"] = {"nudged_at": None}
        await db["authenticity_snapshots"].update_one(
            {"user_id": r.user_id, "local_date": local}, update, upsert=True
        )
        if nudge:
            nudged += 1
            await notification_service.notify(
                db, user_id=r.user_id, type_="observer_nudge", url="/read"
            )
    return {"users": len(results), "nudged": nudged}
