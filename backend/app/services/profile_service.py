"""Profil publik anggota (dilihat rekan setim): foto, fungsi, rak buku, badge, buku favorit."""

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock, media
from app.core.errors import AppError
from app.schemas.user import (
    PublicBadgeOut,
    PublicBookOut,
    PublicProfileOut,
    PublicStatsOut,
)
from app.services import permissions, points_service, shelf_service, streak_service, user_stats


async def _books(db: AsyncDatabase, ids: list[ObjectId]) -> list[PublicBookOut]:
    found = {
        b["_id"]: b
        async for b in db["books"].find(
            {"_id": {"$in": ids}}, {"title": 1, "authors": 1, "cover_image_key": 1}
        )
    }
    out = []
    for book_id in ids:
        book = found.get(book_id)
        if book:
            cover = book.get("cover_image_key")
            out.append(
                PublicBookOut(
                    id=book["_id"],
                    title=book["title"],
                    authors=book["authors"],
                    cover_url=media.signed_url(cover) if cover else None,
                )
            )
    return out


async def public_profile(db: AsyncDatabase, viewer: dict, user_id: ObjectId) -> PublicProfileOut:
    user = await db["users"].find_one({"_id": user_id, "status": "active"})
    if user is None:
        raise AppError(404, "user_not_found", "Pengguna tidak ditemukan")
    role = await permissions.get_role(db, user["role_id"])
    function = (
        await db["functions"].find_one({"_id": user["function_id"]}, {"name": 1})
        if user.get("function_id")
        else None
    )
    stats = user.get("stats") or {}
    points = int(stats.get("points_total", 0))
    level, upcoming = await points_service.level_for(db, points)
    streak = await streak_service.get(db, user_id)
    today = clock.local_date(clock.now(), user.get("timezone", "Asia/Jakarta"))

    badge_rows = await db["user_badges"].find({"user_id": user_id}).sort("awarded_at", -1).to_list()
    badges = {
        b["_id"]: b
        async for b in db["badges"].find({"_id": {"$in": [r["badge_id"] for r in badge_rows]}})
    }
    reading = (
        await db["shelves"]
        .find({"user_id": user_id, "status": "reading"}, {"book_id": 1})
        .sort("updated_at", -1)
        .limit(3)
        .to_list()
    )
    shelf = await shelf_service.shelf(db, user_id, limit=1)

    return PublicProfileOut(
        id=user["_id"],
        name=user["name"],
        avatar_url=user.get("avatar_url"),
        headline=user.get("headline", ""),
        function=function["name"] if function else None,
        role=role["name"] if role else None,
        joined_at=user.get("created_at"),
        level=points_service.level_out(level, upcoming),
        stats=PublicStatsOut(
            points_total=points,
            books_finished=int(stats.get("books_finished", 0)),
            posts_count=int(stats.get("posts_count", 0)),
            current_streak=streak_service.effective_current(
                streak, today, await streak_service.allowance(db)
            ),
            longest_streak=int((streak or {}).get("longest", 0)),
            reading_minutes=await user_stats.metric(db, user_id, "reading_minutes"),
        ),
        badges=[
            PublicBadgeOut(
                id=badges[r["badge_id"]]["_id"],
                name=badges[r["badge_id"]]["name"],
                icon=badges[r["badge_id"]].get("icon", "🏅"),
                description=badges[r["badge_id"]].get("description", ""),
                awarded_at=r["awarded_at"],
            )
            for r in badge_rows
            if r["badge_id"] in badges
        ],
        favorite_books=await _books(db, list(user.get("favorite_book_ids", []))),
        currently_reading=await _books(db, [r["book_id"] for r in reading]),
        shelf_counts=shelf.counts,
        is_me=viewer["_id"] == user_id,
    )
