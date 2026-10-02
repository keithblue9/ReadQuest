from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUser, Db, require_permission
from app.repositories import books, catalog
from app.schemas.books import BookCreateIn, BookOut
from app.schemas.common import PyObjectId
from app.schemas.posts import PostPageOut
from app.services import book_service, post_service

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=list[BookOut])
async def search_books(
    db: Db,
    _: CurrentUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    category_id: PyObjectId | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0, le=1000)] = 0,
) -> list[BookOut]:
    rows = await books.search(db, q=q, category_id=category_id, limit=limit, skip=offset)
    categories = await catalog.categories_by_id(db)
    return [book_service.to_out(b, categories) for b in rows]


@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def create_book(
    data: BookCreateIn,
    db: Db,
    response: Response,
    user: Annotated[dict, Depends(require_permission("book.create"))],
) -> BookOut:
    book, created = await book_service.create_or_get(db, user, data)
    if not created:
        response.status_code = status.HTTP_200_OK
    return book_service.to_out(book, await catalog.categories_by_id(db))


@router.get("/{book_id}", response_model=BookOut)
async def get_book(book_id: PyObjectId, db: Db, _: CurrentUser) -> BookOut:
    book = await book_service.get_or_404(db, book_id)
    return book_service.to_out(book, await catalog.categories_by_id(db))


@router.get("/{book_id}/posts", response_model=PostPageOut)
async def book_posts(
    book_id: PyObjectId,
    db: Db,
    _: CurrentUser,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> PostPageOut:
    await book_service.get_or_404(db, book_id)
    return await post_service.page(db, {"book_id": book_id}, cursor, limit)
