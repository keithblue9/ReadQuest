from datetime import UTC, datetime

from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase


def normalize_code(code: str) -> str:
    return code.strip().upper()


async def consume(
    db: AsyncDatabase, code: str, session: AsyncClientSession | None = None
) -> dict | None:
    """Naikkan `used_count` secara atomik bila kode aktif, belum kedaluwarsa, dan belum habis."""
    now = datetime.now(UTC)
    return await db["invite_codes"].find_one_and_update(
        {
            "code": normalize_code(code),
            "is_active": True,
            "$and": [
                {"$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}]},
                {
                    "$or": [
                        {"max_uses": None},
                        {"$expr": {"$lt": ["$used_count", "$max_uses"]}},
                    ]
                },
            ],
        },
        {"$inc": {"used_count": 1}, "$set": {"updated_at": now}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )
