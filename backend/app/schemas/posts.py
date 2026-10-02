from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PyObjectId


class PostAuthorOut(BaseModel):
    id: PyObjectId
    name: str
    avatar_url: str | None
    function_id: PyObjectId | None


class PostBookOut(BaseModel):
    id: PyObjectId
    title: str
    authors: list[str]
    category_id: PyObjectId | None


class PageProgressOut(BaseModel):
    current_page: int | None = None
    total_pages: int | None = None


class PostCountsOut(BaseModel):
    like: int = 0
    insightful: int = 0
    inspiring: int = 0
    comments: int = 0
    bookmarks: int = 0


class PostOut(BaseModel):
    id: PyObjectId
    type: str
    content: str
    word_count: int
    image_urls: list[str]
    rating: int | None
    page_progress: PageProgressOut | None
    is_book_finished: bool
    topics: list[str]
    author: PostAuthorOut
    book: PostBookOut
    counts: PostCountsOut
    created_at: datetime


class PostPageOut(BaseModel):
    items: list[PostOut]
    next_cursor: str | None
