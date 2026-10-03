"""Reading Buddy: pasangan baca untuk saling menyemangati (maks. satu buddy aktif per user)."""

from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.schemas.gamification import BuddiesOut, BuddyOut, BuddyRequestOut
from app.schemas.posts import UserMiniOut
from app.services import notification_service, streak_service

CHEER_COOLDOWN = timedelta(hours=1)


def _col(db: AsyncDatabase):
    return db["reading_buddies"]


def _mini(user: dict) -> UserMiniOut:
    return UserMiniOut(id=user["_id"], name=user["name"], avatar_url=user.get("avatar_url"))


async def _active_pair(db: AsyncDatabase, user_id: ObjectId) -> dict | None:
    return await _col(db).find_one({"user_ids": user_id, "status": "active"})


async def overview(db: AsyncDatabase, user: dict) -> BuddiesOut:
    pair = await _active_pair(db, user["_id"])
    buddy = None
    if pair:
        other_id = next(u for u in pair["user_ids"] if u != user["_id"])
        other = await db["users"].find_one({"_id": other_id})
        if other:
            streak = await streak_service.get(db, other_id)
            today = clock.local_date(clock.now(), other.get("timezone", "Asia/Jakarta"))
            buddy = BuddyOut(
                pair_id=pair["_id"],
                user=_mini(other),
                read_today=(streak or {}).get("last_read_date") == today,
                streak=streak_service.effective_current(
                    streak, today, await streak_service.allowance(db)
                ),
                since=pair.get("accepted_at"),
            )
    pending = await _col(db).find({"user_ids": user["_id"], "status": "pending"}).to_list()
    others = {
        u["_id"]: u
        async for u in db["users"].find(
            {"_id": {"$in": [i for p in pending for i in p["user_ids"] if i != user["_id"]]}}
        )
    }
    incoming, outgoing = [], []
    for p in pending:
        other_id = next(i for i in p["user_ids"] if i != user["_id"])
        if other_id not in others:
            continue
        item = BuddyRequestOut(
            pair_id=p["_id"], user=_mini(others[other_id]), created_at=p["created_at"]
        )
        (incoming if p["addressee_id"] == user["_id"] else outgoing).append(item)
    return BuddiesOut(buddy=buddy, incoming=incoming, outgoing=outgoing)


async def request(db: AsyncDatabase, user: dict, target_id: ObjectId) -> None:
    if target_id == user["_id"]:
        raise AppError(422, "invalid_buddy", "Tidak bisa menjadi buddy diri sendiri")
    target = await db["users"].find_one({"_id": target_id, "status": "active"})
    if target is None:
        raise AppError(404, "user_not_found", "Pengguna tidak ditemukan")
    if await _active_pair(db, user["_id"]):
        raise AppError(409, "buddy_exists", "Kamu sudah punya Reading Buddy")
    if await _active_pair(db, target_id):
        raise AppError(409, "buddy_taken", f"{target['name']} sudah punya Reading Buddy")
    existing = await _col(db).find_one(
        {"user_ids": {"$all": [user["_id"], target_id]}, "status": "pending"}
    )
    if existing:
        raise AppError(409, "buddy_pending", "Permintaan buddy sudah dikirim")
    now = clock.now()
    await _col(db).insert_one(
        {
            "user_ids": [user["_id"], target_id],
            "requester_id": user["_id"],
            "addressee_id": target_id,
            "status": "pending",
            "last_cheer": {},
            "created_at": now,
            "accepted_at": None,
            "ended_at": None,
        }
    )
    await notification_service.notify(
        db, user_id=target_id, type_="buddy_request", actor=user, url="/buddy"
    )


async def _pending_for(db: AsyncDatabase, user: dict, pair_id: ObjectId) -> dict:
    pair = await _col(db).find_one({"_id": pair_id, "user_ids": user["_id"], "status": "pending"})
    if pair is None:
        raise AppError(404, "buddy_request_not_found", "Permintaan buddy tidak ditemukan")
    return pair


async def accept(db: AsyncDatabase, user: dict, pair_id: ObjectId) -> None:
    pair = await _pending_for(db, user, pair_id)
    if pair["addressee_id"] != user["_id"]:
        raise AppError(403, "forbidden", "Hanya penerima yang dapat menerima permintaan")
    for uid in pair["user_ids"]:
        if await _active_pair(db, uid):
            raise AppError(409, "buddy_exists", "Salah satu dari kalian sudah punya Reading Buddy")
    now = clock.now()
    await _col(db).update_one({"_id": pair_id}, {"$set": {"status": "active", "accepted_at": now}})
    # Permintaan lain yang melibatkan keduanya dibatalkan.
    await _col(db).update_many(
        {"_id": {"$ne": pair_id}, "status": "pending", "user_ids": {"$in": pair["user_ids"]}},
        {"$set": {"status": "cancelled", "ended_at": now}},
    )
    await notification_service.notify(
        db, user_id=pair["requester_id"], type_="buddy_accepted", actor=user, url="/buddy"
    )


async def end(db: AsyncDatabase, user: dict, pair_id: ObjectId) -> None:
    result = await _col(db).update_one(
        {"_id": pair_id, "user_ids": user["_id"], "status": {"$in": ["pending", "active"]}},
        {"$set": {"status": "ended", "ended_at": clock.now()}},
    )
    if not result.matched_count:
        raise AppError(404, "buddy_not_found", "Buddy tidak ditemukan")


async def cheer(db: AsyncDatabase, user: dict, pair_id: ObjectId) -> None:
    pair = await _col(db).find_one({"_id": pair_id, "user_ids": user["_id"], "status": "active"})
    if pair is None:
        raise AppError(404, "buddy_not_found", "Buddy tidak ditemukan")
    now = clock.now()
    last = (pair.get("last_cheer") or {}).get(str(user["_id"]))
    if last and now - last < CHEER_COOLDOWN:
        raise AppError(429, "cheer_cooldown", "Kamu baru saja menyemangati buddy-mu")
    other_id = next(u for u in pair["user_ids"] if u != user["_id"])
    await _col(db).update_one({"_id": pair_id}, {"$set": {f"last_cheer.{user['_id']}": now}})
    await notification_service.notify(
        db, user_id=other_id, type_="buddy_cheer", actor=user, url="/read"
    )
