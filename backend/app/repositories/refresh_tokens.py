from datetime import UTC, datetime

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase


def _col(db: AsyncDatabase):
    return db["refresh_tokens"]


async def insert(
    db: AsyncDatabase,
    *,
    user_id: ObjectId,
    token_hash: str,
    family_id: str,
    expires_at: datetime,
    user_agent: str,
    ip: str,
) -> None:
    await _col(db).insert_one(
        {
            "user_id": user_id,
            "token_hash": token_hash,
            "family_id": family_id,
            "user_agent": user_agent,
            "ip": ip,
            "expires_at": expires_at,
            "revoked_at": None,
            "created_at": datetime.now(UTC),
        }
    )


async def find_by_hash(db: AsyncDatabase, token_hash: str) -> dict | None:
    return await _col(db).find_one({"token_hash": token_hash})


async def revoke_if_active(db: AsyncDatabase, token_hash: str) -> dict | None:
    """Cabut token secara atomik; mengembalikan None bila token sudah dicabut sebelumnya."""
    return await _col(db).find_one_and_update(
        {"token_hash": token_hash, "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(UTC)}},
        return_document=ReturnDocument.AFTER,
    )


async def revoke_family(db: AsyncDatabase, family_id: str) -> None:
    await _col(db).update_many(
        {"family_id": family_id, "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(UTC)}},
    )
