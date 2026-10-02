from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.api.deps import CurrentUser, Db, require_permission
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
