from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUser, Db, require_permission
from app.core.rate_limit import rate_limiter
from app.schemas.common import PyObjectId
from app.schemas.posts import (
    BookmarkStateOut,
    CommentCreatedOut,
    CommentIn,
    CommentOut,
    PostOut,
    PostPageOut,
    ReactionIn,
    ReactionStateOut,
)
from app.services import moderation_service, post_service, share_card, social_service

router = APIRouter(tags=["feed"])

Reactor = Annotated[dict, Depends(require_permission("post.react"))]
Commenter = Annotated[dict, Depends(require_permission("comment.create"))]


@router.get("/feed", response_model=PostPageOut)
async def feed(
    db: Db,
    user: CurrentUser,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 15,
    function_id: PyObjectId | None = None,
    book_id: PyObjectId | None = None,
    author_id: PyObjectId | None = None,
    topic: Annotated[str | None, Query(max_length=40)] = None,
    type: Annotated[str | None, Query(max_length=20)] = None,  # noqa: A002
    bookmarked: bool = False,
) -> PostPageOut:
    query: dict = {}
    if function_id:
        query["author.function_id"] = function_id
    if book_id:
        query["book_id"] = book_id
    if author_id:
        query["author_id"] = author_id
    if topic:
        query["topics"] = topic.lower().lstrip("#")
    if type:
        query["type"] = type
    if bookmarked:
        query["_id"] = {"$in": await social_service.bookmarked_post_ids(db, user["_id"])}
    return await post_service.page(db, query, cursor, limit, viewer_id=user["_id"])


@router.get("/posts/{post_id}", response_model=PostOut)
async def get_post(post_id: PyObjectId, db: Db, user: CurrentUser) -> PostOut:
    post = await social_service.get_post_or_404(db, post_id)
    return (await post_service.enrich(db, [post], user["_id"]))[0]


@router.put("/posts/{post_id}/reaction", response_model=ReactionStateOut)
async def react(post_id: PyObjectId, data: ReactionIn, db: Db, user: Reactor) -> ReactionStateOut:
    rate_limiter.hit(f"react:{user['_id']}", limit=60, window_seconds=60)
    return await social_service.react(db, user, post_id, data.type)


@router.delete("/posts/{post_id}/reaction", response_model=ReactionStateOut)
async def unreact(post_id: PyObjectId, db: Db, user: Reactor) -> ReactionStateOut:
    return await social_service.unreact(db, user, post_id)


@router.put("/posts/{post_id}/bookmark", response_model=BookmarkStateOut)
async def bookmark(post_id: PyObjectId, db: Db, user: CurrentUser) -> BookmarkStateOut:
    return await social_service.bookmark(db, user, post_id)


@router.delete("/posts/{post_id}/bookmark", response_model=BookmarkStateOut)
async def unbookmark(post_id: PyObjectId, db: Db, user: CurrentUser) -> BookmarkStateOut:
    return await social_service.unbookmark(db, user, post_id)


@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
async def list_comments(post_id: PyObjectId, db: Db, _: CurrentUser) -> list[CommentOut]:
    return await social_service.list_comments(db, post_id)


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentCreatedOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: PyObjectId, data: CommentIn, db: Db, user: Commenter
) -> CommentCreatedOut:
    rate_limiter.hit(f"comment:{user['_id']}", limit=20, window_seconds=60)
    return await social_service.create_comment(db, user, post_id, data)


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    post_id: PyObjectId, comment_id: PyObjectId, db: Db, user: CurrentUser
) -> Response:
    await social_service.delete_comment(db, user, post_id, comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/posts/{post_id}/report", status_code=status.HTTP_204_NO_CONTENT)
async def report_post(
    post_id: PyObjectId, data: moderation_service.ReportIn, db: Db, user: CurrentUser
) -> Response:
    rate_limiter.hit(f"report:{user['_id']}", limit=10, window_seconds=3600)
    await moderation_service.report_post(db, user, post_id, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/posts/{post_id}/comments/{comment_id}/report", status_code=status.HTTP_204_NO_CONTENT
)
async def report_comment(
    post_id: PyObjectId,
    comment_id: PyObjectId,
    data: moderation_service.ReportIn,
    db: Db,
    user: CurrentUser,
) -> Response:
    rate_limiter.hit(f"report:{user['_id']}", limit=10, window_seconds=3600)
    await moderation_service.report_comment(db, user, post_id, comment_id, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/posts/{post_id}/share-card.png", include_in_schema=False)
async def share_card_png(post_id: PyObjectId, db: Db, _: CurrentUser) -> Response:
    post = await social_service.get_post_or_404(db, post_id)
    return Response(
        content=await share_card.render(post),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )
