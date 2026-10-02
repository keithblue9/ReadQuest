import re
import unicodedata
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase


def _col(db: AsyncDatabase):
    return db["books"]


def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def normalized_key(title: str, authors: list[str]) -> str:
    return f"{slugify(title)}|{slugify(authors[0]) if authors else ''}"


async def get(db: AsyncDatabase, book_id: ObjectId) -> dict | None:
    return await _col(db).find_one({"_id": book_id})


async def find_by_key(db: AsyncDatabase, key: str) -> dict | None:
    return await _col(db).find_one({"normalized_key": key})


async def insert(db: AsyncDatabase, doc: dict[str, Any]) -> ObjectId:
    return (await _col(db).insert_one(doc)).inserted_id


async def search(
    db: AsyncDatabase,
    *,
    q: str | None,
    category_id: ObjectId | None,
    limit: int,
    skip: int = 0,
) -> list[dict]:
    query: dict[str, Any] = {}
    if q:
        pattern = re.compile(re.escape(q.strip()), re.IGNORECASE)
        query["$or"] = [{"title": pattern}, {"authors": pattern}]
    if category_id:
        query["category_id"] = category_id
    cursor = (
        _col(db).find(query).sort([("stats.posts_count", -1), ("title", 1)]).skip(skip).limit(limit)
    )
    return await cursor.to_list()


async def update(
    db: AsyncDatabase,
    book_id: ObjectId,
    update: dict[str, Any],
    session: AsyncClientSession | None = None,
) -> dict | None:
    return await _col(db).find_one_and_update(
        {"_id": book_id}, update, return_document=ReturnDocument.AFTER, session=session
    )
