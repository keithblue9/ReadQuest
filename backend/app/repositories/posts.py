from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

VISIBLE = {"deleted_at": None, "moderation.status": {"$ne": "hidden"}}


def _col(db: AsyncDatabase):
    return db["posts"]


async def insert(
    db: AsyncDatabase, doc: dict[str, Any], session: AsyncClientSession | None = None
) -> ObjectId:
    return (await _col(db).insert_one(doc, session=session)).inserted_id


async def get_visible(db: AsyncDatabase, post_id: ObjectId) -> dict | None:
    return await _col(db).find_one({"_id": post_id, **VISIBLE})


async def exists_with_hash(db: AsyncDatabase, author_id: ObjectId, content_hash: str) -> bool:
    found = await _col(db).find_one(
        {"author_id": author_id, "content_hash": content_hash, "deleted_at": None}, {"_id": 1}
    )
    return found is not None


async def has_finished_book(db: AsyncDatabase, author_id: ObjectId, book_id: ObjectId) -> bool:
    found = await _col(db).find_one(
        {"author_id": author_id, "book_id": book_id, "is_book_finished": True}, {"_id": 1}
    )
    return found is not None


async def list_page(
    db: AsyncDatabase,
    query: dict[str, Any],
    *,
    before: tuple[datetime, ObjectId] | None,
    limit: int,
) -> list[dict]:
    """Halaman posting terbaru dengan cursor (created_at, _id) agar stabil saat data bertambah."""
    filters: dict[str, Any] = {**VISIBLE, **query}
    if before:
        created_at, post_id = before
        filters["$or"] = [
            {"created_at": {"$lt": created_at}},
            {"created_at": created_at, "_id": {"$lt": post_id}},
        ]
    cursor = _col(db).find(filters).sort([("created_at", -1), ("_id", -1)]).limit(limit)
    return await cursor.to_list()


async def rating_stats(db: AsyncDatabase, book_id: ObjectId) -> float | None:
    pipeline = [
        {"$match": {"book_id": book_id, "rating": {"$ne": None}, **VISIBLE}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
    ]
    rows = await (await _col(db).aggregate(pipeline)).to_list()
    return round(rows[0]["avg"], 2) if rows else None
