"""Book of the Month: dipilih Admin, atau otomatis buku paling ramai 30 hari terakhir."""

from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.repositories import catalog
from app.schemas.gamification import BookOfMonthOut
from app.services import book_service
from app.services.leaderboard_service import period_window


async def _month(db: AsyncDatabase) -> tuple[str, object, object]:
    tz = str(await catalog.get_setting(db, "team.timezone", "Asia/Jakarta"))
    window = period_window("monthly", tz, None, clock.now())
    return window.key, window.start, window.end


async def current(db: AsyncDatabase) -> BookOfMonthOut:
    month, start, end = await _month(db)
    book = await db["books"].find_one({"is_book_of_the_month.month": month})
    auto = False
    if book is None:
        since = clock.now() - timedelta(days=30)
        rows = await (
            await db["posts"].aggregate(
                [
                    {"$match": {"created_at": {"$gte": since}, "deleted_at": None}},
                    {"$group": {"_id": "$book_id", "n": {"$sum": 1}}},
                    {"$sort": {"n": -1, "_id": 1}},
                    {"$limit": 1},
                ]
            )
        ).to_list()
        if rows:
            book = await db["books"].find_one({"_id": rows[0]["_id"]})
            auto = True
    readers = 0
    if book:
        readers = len(
            await db["reading_sessions"].distinct(
                "user_id",
                {
                    "book_id": book["_id"],
                    "status": "completed",
                    "ended_at": {"$gte": start, "$lt": end},
                },
            )
        )
    return BookOfMonthOut(
        month=month,
        auto=auto,
        book=book_service.to_out(book, await catalog.categories_by_id(db)) if book else None,
        readers_this_month=readers,
    )


async def set_current(db: AsyncDatabase, book_id: ObjectId) -> BookOfMonthOut:
    book = await db["books"].find_one({"_id": book_id})
    if book is None:
        raise AppError(404, "book_not_found", "Buku tidak ditemukan")
    month, _, _ = await _month(db)
    await db["books"].update_many(
        {"is_book_of_the_month.month": month}, {"$set": {"is_book_of_the_month": None}}
    )
    await db["books"].update_one(
        {"_id": book_id}, {"$set": {"is_book_of_the_month": {"month": month}}}
    )
    return await current(db)
