"""Rak buku pribadi: Sedang dibaca, Ingin dibaca, Selesai. Terlihat oleh rekan setim.

Status diisi otomatis dari aktivitas (mulai sesi → Sedang dibaca, tamat → Selesai, reaksi
"Mau baca juga" → Ingin dibaca) dan bisa diubah manual.
"""

from bson import ObjectId
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock, media
from app.core.errors import AppError
from app.repositories import books
from app.schemas.shelf import ShelfBookOut, ShelfItemOut, ShelfOut

STATUSES = ("reading", "want", "finished")


async def set_status(
    db: AsyncDatabase,
    user_id: ObjectId,
    book_id: ObjectId,
    status: str,
    *,
    automatic: bool = False,
    session: AsyncClientSession | None = None,
) -> None:
    """`automatic`: perubahan dari aktivitas tidak menurunkan status yang lebih "maju"
    (buku yang sudah Selesai tidak kembali ke Sedang dibaca; Ingin dibaca hanya bila belum ada)."""
    now = clock.now()
    query = {"user_id": user_id, "book_id": book_id}
    if automatic and status in ("want", "reading"):
        existing = await db["shelves"].find_one(query, {"status": 1}, session=session)
        if existing and (status == "want" or existing["status"] == "finished"):
            return
    await db["shelves"].update_one(
        query,
        {"$set": {"status": status, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
        session=session,
    )


async def set_manual(db: AsyncDatabase, user: dict, book_id: ObjectId, status: str) -> None:
    if await books.get(db, book_id) is None:
        raise AppError(404, "book_not_found", "Buku tidak ditemukan")
    await set_status(db, user["_id"], book_id, status)


async def remove(db: AsyncDatabase, user: dict, book_id: ObjectId) -> None:
    await db["shelves"].delete_one({"user_id": user["_id"], "book_id": book_id})


async def status_for(db: AsyncDatabase, user_id: ObjectId, book_id: ObjectId) -> str | None:
    doc = await db["shelves"].find_one({"user_id": user_id, "book_id": book_id}, {"status": 1})
    return doc["status"] if doc else None


async def shelf(
    db: AsyncDatabase, user_id: ObjectId, status: str | None = None, limit: int = 200
) -> ShelfOut:
    query: dict = {"user_id": user_id}
    if status:
        query["status"] = status
    rows = await db["shelves"].find(query).sort("updated_at", -1).limit(limit).to_list()
    found = {
        b["_id"]: b
        async for b in db["books"].find(
            {"_id": {"$in": [r["book_id"] for r in rows]}},
            {"title": 1, "authors": 1, "cover_image_key": 1},
        )
    }
    counts = dict.fromkeys(STATUSES, 0)
    async for row in await db["shelves"].aggregate(
        [{"$match": {"user_id": user_id}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ):
        counts[row["_id"]] = row["n"]
    items = []
    for r in rows:
        book = found.get(r["book_id"])
        if not book:
            continue
        cover = book.get("cover_image_key")
        items.append(
            ShelfItemOut(
                book=ShelfBookOut(
                    id=book["_id"],
                    title=book["title"],
                    authors=book["authors"],
                    cover_url=media.signed_url(cover) if cover else None,
                ),
                status=r["status"],
                updated_at=r["updated_at"],
            )
        )
    return ShelfOut(items=items, counts=counts)
