from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import PyObjectId
from app.schemas.points import AwardOut

ReactionType = Literal["like", "insightful", "inspiring"]


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


class UserMiniOut(BaseModel):
    id: PyObjectId
    name: str
    avatar_url: str | None = None


class ViewerStateOut(BaseModel):
    reaction: ReactionType | None = None
    bookmarked: bool = False


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
    mentions: list[UserMiniOut] = []
    viewer: ViewerStateOut = ViewerStateOut()
    created_at: datetime


class PostPageOut(BaseModel):
    items: list[PostOut]
    next_cursor: str | None


class ReactionIn(BaseModel):
    type: ReactionType


class ReactionStateOut(BaseModel):
    reaction: ReactionType | None
    counts: PostCountsOut


class BookmarkStateOut(BaseModel):
    bookmarked: bool
    bookmarks: int


class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    parent_id: PyObjectId | None = None
    mention_ids: list[PyObjectId] = Field(default_factory=list, max_length=10)


class CommentOut(BaseModel):
    id: PyObjectId
    post_id: PyObjectId
    parent_id: PyObjectId | None
    root_id: PyObjectId | None
    author: UserMiniOut
    content: str
    is_meaningful: bool
    deleted: bool
    mentions: list[UserMiniOut] = []
    created_at: datetime


class CommentCreatedOut(BaseModel):
    comment: CommentOut
    points: list[AwardOut]


class DiscussionIn(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    image_keys: list[str] = Field(default_factory=list, max_length=4)
    mention_ids: list[PyObjectId] = Field(default_factory=list, max_length=10)
