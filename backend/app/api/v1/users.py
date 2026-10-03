import re
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, Db
from app.core.errors import AppError
from app.schemas.common import PyObjectId
from app.schemas.posts import UserMiniOut
from app.schemas.shelf import ShelfOut, ShelfStatus
from app.schemas.user import PublicProfileOut
from app.services import profile_service, shelf_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserMiniOut])
async def search_users(
    db: Db,
    _: CurrentUser,
    q: Annotated[str, Query(min_length=1, max_length=50)],
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
) -> list[UserMiniOut]:
    """Untuk autocomplete @mention."""
    pattern = re.compile(re.escape(q.strip()), re.IGNORECASE)
    cursor = (
        db["users"]
        .find({"status": "active", "name": pattern}, {"name": 1, "avatar_url": 1})
        .sort("name", 1)
        .limit(limit)
    )
    return [
        UserMiniOut(id=u["_id"], name=u["name"], avatar_url=u.get("avatar_url"))
        async for u in cursor
    ]


@router.get("/{user_id}", response_model=PublicProfileOut)
async def public_profile(user_id: PyObjectId, db: Db, viewer: CurrentUser) -> PublicProfileOut:
    return await profile_service.public_profile(db, viewer, user_id)


@router.get("/{user_id}/shelf", response_model=ShelfOut)
async def user_shelf(
    user_id: PyObjectId, db: Db, _: CurrentUser, status: ShelfStatus | None = None
) -> ShelfOut:
    if await db["users"].find_one({"_id": user_id, "status": "active"}, {"_id": 1}) is None:
        raise AppError(404, "user_not_found", "Pengguna tidak ditemukan")
    return await shelf_service.shelf(db, user_id, status)
