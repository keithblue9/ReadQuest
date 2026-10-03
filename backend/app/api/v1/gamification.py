from typing import Annotated

import anyio
from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.api.deps import CurrentUser, Db, require_permission
from app.core.errors import AppError
from app.schemas.authenticity import AuthenticityOut, AuthenticityTeamOut
from app.schemas.common import PyObjectId
from app.schemas.gamification import BadgeOut, BookOfMonthOut, BuddiesOut, QuestOut
from app.services import (
    audit_service,
    authenticity_service,
    badge_service,
    book_of_month_service,
    buddy_service,
    quest_service,
    share_card,
    ui_config_service,
)

router = APIRouter(tags=["gamification"])


# ---------- Authenticity Index ----------


@router.get("/me/authenticity", response_model=AuthenticityOut)
async def my_authenticity(db: Db, user: CurrentUser) -> AuthenticityOut:
    return await authenticity_service.for_user(db, user, user["_id"])


@router.get("/authenticity/users/{user_id}", response_model=AuthenticityOut)
async def user_authenticity(user_id: PyObjectId, db: Db, user: CurrentUser) -> AuthenticityOut:
    return await authenticity_service.for_user(db, user, user_id)


@router.get("/authenticity/team", response_model=AuthenticityTeamOut)
async def team_authenticity(
    db: Db, user: CurrentUser, function_id: PyObjectId | None = None
) -> AuthenticityTeamOut:
    return await authenticity_service.team(db, user, function_id)


# ---------- Badge & quest ----------


@router.get("/me/badges", response_model=list[BadgeOut])
async def my_badges(db: Db, user: CurrentUser) -> list[BadgeOut]:
    await badge_service.evaluate(db, user)
    return await badge_service.list_for(db, user)


@router.get("/me/badges/{badge_id}/card.png", include_in_schema=False)
async def my_badge_card(badge_id: PyObjectId, db: Db, user: CurrentUser) -> Response:
    """Kartu sertifikat badge (PNG) untuk dibagikan, mis. ke LinkedIn."""
    earned = await db["user_badges"].find_one({"user_id": user["_id"], "badge_id": badge_id})
    badge = await db["badges"].find_one({"_id": badge_id}) if earned else None
    if badge is None:
        raise AppError(404, "badge_not_found", "Badge belum kamu dapatkan")
    branding = await ui_config_service.branding(db)
    png = await anyio.to_thread.run_sync(
        lambda: share_card.render_badge(
            holder=user["name"], badge=badge, awarded_at=earned["awarded_at"], branding=branding
        )
    )
    return Response(
        content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/quests", response_model=list[QuestOut])
async def quests(db: Db, user: CurrentUser) -> list[QuestOut]:
    items, _ = await quest_service.evaluate(db, user)
    return items


# ---------- Book of the Month ----------


@router.get("/book-of-the-month", response_model=BookOfMonthOut)
async def book_of_the_month(db: Db, _: CurrentUser) -> BookOfMonthOut:
    return await book_of_month_service.current(db)


@router.put("/book-of-the-month/{book_id}", response_model=BookOfMonthOut)
async def set_book_of_the_month(
    book_id: PyObjectId,
    db: Db,
    request: Request,
    actor: Annotated[dict, Depends(require_permission("config.books.manage"))],
) -> BookOfMonthOut:
    result = await book_of_month_service.set_current(db, book_id)
    await audit_service.log(
        db,
        actor=actor,
        action="book_of_month.set",
        entity_type="book_of_month",
        entity_id=book_id,
        after={"month": result.month, "book_id": book_id},
        ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    )
    return result


# ---------- Reading Buddy ----------


@router.get("/buddies", response_model=BuddiesOut)
async def buddies(db: Db, user: CurrentUser) -> BuddiesOut:
    return await buddy_service.overview(db, user)


@router.post("/buddies", response_model=BuddiesOut, status_code=status.HTTP_201_CREATED)
async def request_buddy(
    db: Db, user: CurrentUser, user_id: Annotated[PyObjectId, Query()]
) -> BuddiesOut:
    await buddy_service.request(db, user, user_id)
    return await buddy_service.overview(db, user)


@router.post("/buddies/{pair_id}/accept", response_model=BuddiesOut)
async def accept_buddy(pair_id: PyObjectId, db: Db, user: CurrentUser) -> BuddiesOut:
    await buddy_service.accept(db, user, pair_id)
    return await buddy_service.overview(db, user)


@router.delete("/buddies/{pair_id}", response_model=BuddiesOut)
async def end_buddy(pair_id: PyObjectId, db: Db, user: CurrentUser) -> BuddiesOut:
    await buddy_service.end(db, user, pair_id)
    return await buddy_service.overview(db, user)


@router.post("/buddies/{pair_id}/cheer", status_code=status.HTTP_204_NO_CONTENT)
async def cheer_buddy(pair_id: PyObjectId, db: Db, user: CurrentUser) -> Response:
    await buddy_service.cheer(db, user, pair_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
