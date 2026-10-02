"""Statistik aktivitas user (dipakai kriteria badge & quest), dihitung dari data mentah."""

from datetime import datetime

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

NOTE_TYPES = ["quick_note", "chapter_story", "book_review"]


async def _count(db: AsyncDatabase, collection: str, query: dict) -> int:
    return await db[collection].count_documents(query)


async def _sum(db: AsyncDatabase, collection: str, query: dict, field: str) -> int:
    rows = await (
        await db[collection].aggregate(
            [{"$match": query}, {"$group": {"_id": None, "v": {"$sum": f"${field}"}}}]
        )
    ).to_list()
    return int(rows[0]["v"]) if rows else 0


async def metric(
    db: AsyncDatabase,
    user_id: ObjectId,
    name: str,
    since: datetime | None = None,
    until: datetime | None = None,
) -> int:
    """Nilai satu metrik dalam rentang waktu (opsional)."""
    window: dict = {}
    if since or until:
        window["created_at"] = {k: v for k, v in (("$gte", since), ("$lt", until)) if v}
    posts = {"author_id": user_id, "deleted_at": None, **window}
    sessions = {"user_id": user_id, "status": "completed"}
    if since or until:
        sessions["ended_at"] = window["created_at"]

    if name == "sessions_count":
        return await _count(db, "reading_sessions", sessions)
    if name == "reading_minutes":
        return await _sum(db, "reading_sessions", sessions, "active_seconds") // 60
    if name == "reading_days":
        rows = await (
            await db["reading_sessions"].aggregate(
                [{"$match": sessions}, {"$group": {"_id": "$local_date"}}, {"$count": "n"}]
            )
        ).to_list()
        return rows[0]["n"] if rows else 0
    if name == "notes_count":
        return await _count(db, "posts", {**posts, "type": {"$in": NOTE_TYPES}})
    if name == "chapter_story_count":
        return await _count(db, "posts", {**posts, "type": "chapter_story"})
    if name == "book_review_count":
        return await _count(db, "posts", {**posts, "type": "book_review"})
    if name == "discussion_count":
        return await _count(db, "posts", {**posts, "type": "discussion"})
    if name == "books_finished":
        return await _count(db, "posts", {**posts, "is_book_finished": True})
    if name == "meaningful_comments_given":
        return await _count(
            db,
            "comments",
            {"author_id": user_id, "is_meaningful": True, "deleted_at": None, **window},
        )
    if name == "reactions_given":
        return await _count(db, "reactions", {"user_id": user_id, "type": {"$ne": None}, **window})
    if name == "reactions_received":
        return await _count(
            db,
            "reactions",
            {
                "post_author_id": user_id,
                "user_id": {"$ne": user_id},
                "type": {"$ne": None},
                **window,
            },
        )
    if name == "streak_longest":
        streak = await db["streaks"].find_one({"user_id": user_id})
        return int((streak or {}).get("longest", 0))
    raise ValueError(f"Metrik tidak dikenal: {name}")


METRICS = [
    "sessions_count",
    "reading_minutes",
    "reading_days",
    "notes_count",
    "chapter_story_count",
    "book_review_count",
    "discussion_count",
    "books_finished",
    "meaningful_comments_given",
    "reactions_given",
    "reactions_received",
    "streak_longest",
]
