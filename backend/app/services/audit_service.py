"""Audit log perubahan konfigurasi & moderasi (append-only)."""

from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock

SENSITIVE = {"password_hash", "token_hash", "keys"}


def _clean(doc: Any) -> Any:
    if isinstance(doc, dict):
        return {k: _clean(v) for k, v in doc.items() if k not in SENSITIVE}
    if isinstance(doc, list):
        return [_clean(v) for v in doc]
    return doc


async def log(
    db: AsyncDatabase,
    *,
    actor: dict,
    action: str,
    entity_type: str,
    entity_id: ObjectId | str | None,
    before: dict | None = None,
    after: dict | None = None,
    ip: str = "",
    user_agent: str = "",
) -> None:
    await db["audit_logs"].insert_one(
        {
            "actor_id": actor["_id"],
            "actor_name": actor.get("name"),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "before": _clean(before),
            "after": _clean(after),
            "ip": ip,
            "user_agent": user_agent[:256],
            "created_at": clock.now(),
        }
    )
