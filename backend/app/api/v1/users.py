import re
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, Db
from app.schemas.posts import UserMiniOut

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
