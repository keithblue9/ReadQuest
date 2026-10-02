import base64
from datetime import datetime

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import media
from app.core.errors import AppError
from app.repositories import posts
from app.schemas.posts import (
    PageProgressOut,
    PostAuthorOut,
    PostBookOut,
    PostCountsOut,
    PostOut,
    PostPageOut,
    UserMiniOut,
    ViewerStateOut,
)


async def users_by_id(db: AsyncDatabase, ids: set[ObjectId]) -> dict[ObjectId, dict]:
    if not ids:
        return {}
    cursor = db["users"].find({"_id": {"$in": list(ids)}}, {"name": 1, "avatar_url": 1})
    return {u["_id"]: u async for u in cursor}


def mini(user_id: ObjectId, users: dict[ObjectId, dict]) -> UserMiniOut | None:
    user = users.get(user_id)
    if not user:
        return None
    return UserMiniOut(id=user_id, name=user["name"], avatar_url=user.get("avatar_url"))


async def enrich(
    db: AsyncDatabase, posts_: list[dict], viewer_id: ObjectId | None
) -> list[PostOut]:
    """PostOut + status viewer (reaksi & bookmark) + nama user yang di-mention."""
    ids = [p["_id"] for p in posts_]
    reactions: dict[ObjectId, str] = {}
    bookmarked: set[ObjectId] = set()
    if viewer_id and ids:
        async for r in db["reactions"].find(
            {"post_id": {"$in": ids}, "user_id": viewer_id, "type": {"$ne": None}}
        ):
            reactions[r["post_id"]] = r["type"]
        async for b in db["bookmarks"].find({"post_id": {"$in": ids}, "user_id": viewer_id}):
            bookmarked.add(b["post_id"])
    mention_ids = {m for p in posts_ for m in p.get("mentions", [])}
    users = await users_by_id(db, mention_ids)
    out = []
    for p in posts_:
        item = to_out(p)
        item.viewer = ViewerStateOut(
            reaction=reactions.get(p["_id"]), bookmarked=p["_id"] in bookmarked
        )
        item.mentions = [m for m in (mini(i, users) for i in p.get("mentions", [])) if m]
        out.append(item)
    return out


def to_out(post: dict) -> PostOut:
    author = post["author"]
    book = post["book"]
    progress = post.get("page_progress")
    return PostOut(
        id=post["_id"],
        type=post["type"],
        content=post["content"],
        word_count=post.get("word_count", 0),
        image_urls=[media.signed_url(k) for k in post.get("image_keys", [])],
        rating=post.get("rating"),
        page_progress=PageProgressOut(**progress) if progress else None,
        is_book_finished=post.get("is_book_finished", False),
        topics=post.get("topics", []),
        author=PostAuthorOut(
            id=post["author_id"],
            name=author["name"],
            avatar_url=author.get("avatar_url"),
            function_id=author.get("function_id"),
        ),
        book=PostBookOut(
            id=post["book_id"],
            title=book["title"],
            authors=book["authors"],
            category_id=book.get("category_id"),
        ),
        counts=PostCountsOut(**(post.get("counts") or {})),
        created_at=post["created_at"],
    )


def encode_cursor(post: dict) -> str:
    raw = f"{post['created_at'].isoformat()}|{post['_id']}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str | None) -> tuple[datetime, ObjectId] | None:
    if not cursor:
        return None
    try:
        created, post_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(created), ObjectId(post_id)
    except Exception as exc:  # noqa: BLE001
        raise AppError(400, "invalid_cursor", "Cursor tidak valid") from exc


async def page(
    db: AsyncDatabase,
    query: dict,
    cursor: str | None,
    limit: int,
    viewer_id: ObjectId | None = None,
) -> PostPageOut:
    rows = await posts.list_page(db, query, before=decode_cursor(cursor), limit=limit + 1)
    has_more = len(rows) > limit
    rows = rows[:limit]
    return PostPageOut(
        items=await enrich(db, rows, viewer_id),
        next_cursor=encode_cursor(rows[-1]) if has_more and rows else None,
    )
