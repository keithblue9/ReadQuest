from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase


def _col(db: AsyncDatabase):
    return db["points_ledger"]


async def insert(
    db: AsyncDatabase, doc: dict[str, Any], session: AsyncClientSession | None = None
) -> ObjectId:
    return (await _col(db).insert_one(doc, session=session)).inserted_id


async def exists(
    db: AsyncDatabase,
    user_id: ObjectId,
    rule_code: str,
    source_type: str,
    source_id: ObjectId | None,
    session: AsyncClientSession | None = None,
) -> bool:
    found = await _col(db).find_one(
        {
            "user_id": user_id,
            "rule_code": rule_code,
            "source_type": source_type,
            "source_id": source_id,
        },
        {"_id": 1},
        session=session,
    )
    return found is not None


async def daily_usage(
    db: AsyncDatabase,
    user_id: ObjectId,
    local_date: str,
    rule_code: str,
    session: AsyncClientSession | None = None,
) -> tuple[int, int]:
    """(jumlah entri, total poin) untuk satu aturan pada satu tanggal lokal."""
    pipeline = [
        {"$match": {"user_id": user_id, "local_date": local_date, "rule_code": rule_code}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "points": {"$sum": "$points"}}},
    ]
    rows = await (await _col(db).aggregate(pipeline, session=session)).to_list()
    return (rows[0]["count"], rows[0]["points"]) if rows else (0, 0)


async def total_for_user(db: AsyncDatabase, user_id: ObjectId) -> int:
    rows = await (
        await _col(db).aggregate(
            [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": None, "sum": {"$sum": "$points"}}},
            ]
        )
    ).to_list()
    return int(rows[0]["sum"]) if rows else 0


async def sum_on_date(db: AsyncDatabase, user_id: ObjectId, local_date: str) -> int:
    rows = await (
        await _col(db).aggregate(
            [
                {"$match": {"user_id": user_id, "local_date": local_date}},
                {"$group": {"_id": None, "sum": {"$sum": "$points"}}},
            ]
        )
    ).to_list()
    return int(rows[0]["sum"]) if rows else 0


async def page_for_user(
    db: AsyncDatabase, user_id: ObjectId, before: tuple[datetime, ObjectId] | None, limit: int
) -> list[dict]:
    query: dict[str, Any] = {"user_id": user_id}
    if before:
        created_at, entry_id = before
        query["$or"] = [
            {"created_at": {"$lt": created_at}},
            {"created_at": created_at, "_id": {"$lt": entry_id}},
        ]
    cursor = _col(db).find(query).sort([("created_at", -1), ("_id", -1)]).limit(limit)
    return await cursor.to_list()
