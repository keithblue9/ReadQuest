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
)


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


async def page(db: AsyncDatabase, query: dict, cursor: str | None, limit: int) -> PostPageOut:
    rows = await posts.list_page(db, query, before=decode_cursor(cursor), limit=limit + 1)
    has_more = len(rows) > limit
    rows = rows[:limit]
    return PostPageOut(
        items=[to_out(p) for p in rows],
        next_cursor=encode_cursor(rows[-1]) if has_more and rows else None,
    )
