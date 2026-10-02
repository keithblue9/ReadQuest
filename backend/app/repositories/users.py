from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase


def _col(db: AsyncDatabase):
    return db["users"]


async def find_by_phone(db: AsyncDatabase, phone: str) -> dict | None:
    return await _col(db).find_one({"phone": phone})


async def find_by_id(db: AsyncDatabase, user_id: ObjectId) -> dict | None:
    return await _col(db).find_one({"_id": user_id})


async def insert(
    db: AsyncDatabase, doc: dict[str, Any], session: AsyncClientSession | None = None
) -> ObjectId:
    result = await _col(db).insert_one(doc, session=session)
    return result.inserted_id


async def update(db: AsyncDatabase, user_id: ObjectId, fields: dict[str, Any]) -> dict | None:
    fields = {**fields, "updated_at": datetime.now(UTC)}
    return await _col(db).find_one_and_update(
        {"_id": user_id}, {"$set": fields}, return_document=ReturnDocument.AFTER
    )


async def touch_last_active(db: AsyncDatabase, user_id: ObjectId) -> None:
    await _col(db).update_one({"_id": user_id}, {"$set": {"last_active_at": datetime.now(UTC)}})
