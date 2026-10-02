import time

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.repositories import catalog

_TTL_SECONDS = 60
_cache: dict[ObjectId, tuple[float, dict]] = {}


async def get_role(db: AsyncDatabase, role_id: ObjectId) -> dict | None:
    """Role + permission_codes, di-cache singkat agar tidak query di setiap request."""
    now = time.monotonic()
    cached = _cache.get(role_id)
    if cached and cached[0] > now:
        return cached[1]
    role = await catalog.get_role(db, role_id)
    if role is not None:
        _cache[role_id] = (now + _TTL_SECONDS, role)
    return role


def clear_cache() -> None:
    _cache.clear()
