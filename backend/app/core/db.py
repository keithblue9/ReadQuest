from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings

_client: AsyncMongoClient | None = None


async def connect() -> None:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncMongoClient(settings.mongodb_uri, tz_aware=True)


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


def get_client() -> AsyncMongoClient:
    if _client is None:
        raise RuntimeError("MongoDB belum terhubung; panggil connect() dulu")
    return _client


def get_db() -> AsyncDatabase:
    return get_client()[get_settings().mongodb_db]
