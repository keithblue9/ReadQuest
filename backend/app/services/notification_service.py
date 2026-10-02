"""Pembuatan notifikasi in-app. Pengiriman push, preferensi, dan batching ditambahkan di Fase 8."""

from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock


async def create(
    db: AsyncDatabase,
    *,
    user_id: ObjectId,
    type_: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    actor_ids: list[ObjectId] | None = None,
    group_key: str | None = None,
) -> ObjectId:
    now = clock.now()
    result = await db["notifications"].insert_one(
        {
            "user_id": user_id,
            "type": type_,
            "title": title,
            "body": body,
            "data": data or {},
            "actor_ids": actor_ids or [],
            "group_key": group_key,
            "read_at": None,
            "push_status": "pending",
            "created_at": now,
            "updated_at": now,
        }
    )
    return result.inserted_id
