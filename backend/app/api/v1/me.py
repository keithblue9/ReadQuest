from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, Db
from app.core.rate_limit import rate_limiter
from app.repositories import catalog
from app.schemas.auth import ChangePinIn
from app.schemas.catalog import CategoryOut, FunctionOut, OnboardingOptionsOut
from app.schemas.points import LedgerPageOut, PointsSummaryOut
from app.schemas.user import MeOut, MeUpdateIn, OnboardingIn
from app.services import auth_service, points_service, user_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MeOut)
async def get_me(db: Db, user: CurrentUser) -> MeOut:
    return await user_service.build_me(db, user)


@router.patch("", response_model=MeOut)
async def update_me(data: MeUpdateIn, db: Db, user: CurrentUser) -> MeOut:
    updated = await user_service.update_me(db, user, data)
    return await user_service.build_me(db, updated)


@router.put("/pin", status_code=status.HTTP_204_NO_CONTENT)
async def change_pin(data: ChangePinIn, db: Db, user: CurrentUser) -> Response:
    rate_limiter.hit(f"pin:{user['_id']}", limit=5, window_seconds=300)
    await auth_service.change_pin(db, user, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/points", response_model=PointsSummaryOut)
async def my_points(db: Db, user: CurrentUser) -> PointsSummaryOut:
    return await points_service.summary(db, user)


@router.get("/points/history", response_model=LedgerPageOut)
async def my_points_history(
    db: Db,
    user: CurrentUser,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> LedgerPageOut:
    return await points_service.history(db, user["_id"], cursor, limit)


@router.get("/onboarding/options", response_model=OnboardingOptionsOut)
async def onboarding_options(db: Db, user: CurrentUser) -> OnboardingOptionsOut:
    functions = await catalog.list_active_functions(db)
    categories = await catalog.list_active_categories(db)
    min_minutes, default_minutes = await user_service.daily_target_bounds(db)
    return OnboardingOptionsOut(
        functions=[
            FunctionOut(id=f["_id"], name=f["name"], code=f["code"], parent_id=f.get("parent_id"))
            for f in functions
        ],
        categories=[
            CategoryOut(id=c["_id"], name=c["name"], code=c["code"], icon=c.get("icon"))
            for c in categories
        ],
        daily_target_min_minutes=min_minutes,
        daily_target_default_minutes=max(default_minutes, min_minutes),
    )


@router.put("/onboarding", response_model=MeOut)
async def complete_onboarding(data: OnboardingIn, db: Db, user: CurrentUser) -> MeOut:
    updated = await user_service.complete_onboarding(db, user, data)
    return await user_service.build_me(db, updated)
