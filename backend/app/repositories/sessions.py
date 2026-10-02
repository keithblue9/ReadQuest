from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

OPEN_STATUSES = ["active", "paused"]


def _col(db: AsyncDatabase):
    return db["reading_sessions"]


async def get_owned(db: AsyncDatabase, session_id: ObjectId, user_id: ObjectId) -> dict | None:
    return await _col(db).find_one({"_id": session_id, "user_id": user_id})


async def find_open(db: AsyncDatabase, user_id: ObjectId) -> dict | None:
    return await _col(db).find_one(
        {"user_id": user_id, "status": {"$in": OPEN_STATUSES}}, sort=[("started_at", -1)]
    )


async def insert(db: AsyncDatabase, doc: dict[str, Any]) -> ObjectId:
    return (await _col(db).insert_one(doc)).inserted_id


async def update_if_unchanged(
    db: AsyncDatabase, session_id: ObjectId, last_heartbeat_at: datetime, fields: dict[str, Any]
) -> dict | None:
    """Update optimistis: gagal (None) bila heartbeat lain sudah memproses sesi ini."""
    return await _col(db).find_one_and_update(
        {
            "_id": session_id,
            "status": {"$in": OPEN_STATUSES},
            "last_heartbeat_at": last_heartbeat_at,
        },
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )


async def set_fields(
    db: AsyncDatabase,
    session_id: ObjectId,
    fields: dict[str, Any],
    session: AsyncClientSession | None = None,
) -> None:
    await _col(db).update_one({"_id": session_id}, {"$set": fields}, session=session)


async def has_full_points_on(db: AsyncDatabase, user_id: ObjectId, local_date: str) -> bool:
    found = await _col(db).find_one(
        {"user_id": user_id, "local_date": local_date, "is_full_points": True}, {"_id": 1}
    )
    return found is not None


async def has_completed_book(db: AsyncDatabase, user_id: ObjectId, book_id: ObjectId) -> bool:
    found = await _col(db).find_one(
        {"user_id": user_id, "book_id": book_id, "status": "completed"}, {"_id": 1}
    )
    return found is not None


async def list_recent(db: AsyncDatabase, user_id: ObjectId, limit: int) -> list[dict]:
    cursor = _col(db).find({"user_id": user_id}).sort("started_at", -1).limit(limit)
    return await cursor.to_list()
