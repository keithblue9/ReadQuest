from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import Db, require_permission
from app.schemas.leaderboard import Category, LeaderboardOut, LeaderboardSummaryItemOut, Period
from app.services import leaderboard_service

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

Viewer = Annotated[dict, Depends(require_permission("leaderboard.view"))]


@router.get("", response_model=LeaderboardOut)
async def get_leaderboard(
    db: Db,
    user: Viewer,
    category: Category = "top_storyteller",
    period: Period = "weekly",
    period_key: Annotated[str | None, Query(max_length=10)] = None,
) -> LeaderboardOut:
    return await leaderboard_service.leaderboard(db, user, category, period, period_key)


@router.get("/me", response_model=list[LeaderboardSummaryItemOut])
async def my_ranks(
    db: Db, user: Viewer, period: Period = "weekly"
) -> list[LeaderboardSummaryItemOut]:
    return await leaderboard_service.my_summary(db, user, period)
