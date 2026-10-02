from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock, media
from app.core.errors import AppError
from app.repositories import books, catalog
from app.schemas.books import BookCreateIn, BookOut, BookStatsOut, CategoryRef
from app.services.upload_service import owns_key


def to_out(book: dict, categories: dict[ObjectId, dict]) -> BookOut:
    category = categories.get(book.get("category_id"))
    cover_key = book.get("cover_image_key")
    return BookOut(
        id=book["_id"],
        title=book["title"],
        authors=book["authors"],
        category=CategoryRef(id=category["_id"], name=category["name"], icon=category.get("icon"))
        if category
        else None,
        publisher=book.get("publisher"),
        year=book.get("year"),
        total_pages=book.get("total_pages"),
        isbn=book.get("isbn"),
        cover_url=media.signed_url(cover_key) if cover_key else None,
        stats=BookStatsOut(**(book.get("stats") or {})),
        created_at=book["created_at"],
    )


async def create_or_get(db: AsyncDatabase, user: dict, data: BookCreateIn) -> tuple[dict, bool]:
    """Buat buku baru, atau kembalikan buku yang sama bila sudah ada (1 buku = 1 halaman)."""
    key = books.normalized_key(data.title, data.authors)
    existing = await books.find_by_key(db, key)
    if existing:
        return existing, False

    category = await catalog.get_category(db, data.category_id)
    if category is None or not category.get("is_active", True):
        raise AppError(422, "invalid_category", "Kategori tidak ditemukan")
    if data.cover_image_key and not owns_key(user["_id"], data.cover_image_key):
        raise AppError(422, "invalid_image", "Foto sampul tidak valid")

    now = clock.now()
    doc = {
        "title": data.title,
        "authors": data.authors,
        "category_id": data.category_id,
        "normalized_key": key,
        "cover_image_key": data.cover_image_key,
        "publisher": data.publisher,
        "year": data.year,
        "total_pages": data.total_pages,
        "isbn": data.isbn,
        "stats": {"readers_count": 0, "posts_count": 0, "avg_rating": None, "finished_count": 0},
        "is_book_of_the_month": None,
        "created_by": user["_id"],
        "created_at": now,
        "updated_at": now,
    }
    try:
        doc["_id"] = await books.insert(db, doc)
    except DuplicateKeyError:
        # Dibuat bersamaan oleh user lain.
        return await books.find_by_key(db, key), False
    return doc, True


async def get_or_404(db: AsyncDatabase, book_id: ObjectId) -> dict:
    book = await books.get(db, book_id)
    if book is None:
        raise AppError(404, "book_not_found", "Buku tidak ditemukan")
    return book
