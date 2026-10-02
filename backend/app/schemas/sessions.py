from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import PyObjectId
from app.schemas.points import PointsResultOut
from app.schemas.posts import PostOut

NoteType = Literal["quick_note", "chapter_story", "book_review"]


class SessionStartIn(BaseModel):
    book_id: PyObjectId


class HeartbeatIn(BaseModel):
    state: Literal["active", "paused"]


class FinishIn(BaseModel):
    note_type: NoteType
    content: str = Field(min_length=1, max_length=10000)
    image_keys: list[str] = Field(min_length=1, max_length=4)
    rating: int | None = Field(default=None, ge=1, le=5)
    current_page: int | None = Field(default=None, ge=0, le=10000)
    total_pages: int | None = Field(default=None, ge=1, le=10000)
    is_book_finished: bool = False
    pasted_chars: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _pages(self) -> "FinishIn":
        if self.current_page and self.total_pages and self.current_page > self.total_pages:
            raise ValueError("Halaman saat ini melebihi total halaman")
        return self


class SessionBookOut(BaseModel):
    id: PyObjectId
    title: str
    authors: list[str]
    cover_url: str | None


class SessionOut(BaseModel):
    id: PyObjectId
    book: SessionBookOut
    status: str
    active_seconds: int
    min_seconds: int
    started_at: datetime
    ended_at: datetime | None
    local_date: str
    is_full_points: bool
    post_id: PyObjectId | None


class SessionConfigOut(BaseModel):
    min_seconds: int
    idle_timeout_seconds: int
    heartbeat_interval_seconds: int
    note_min_words: dict[str, int]
    note_min_unique_ratio: float
    note_max_paste_ratio: float


class TodayOut(BaseModel):
    local_date: str
    full_points_done: bool
    active_session: SessionOut | None


class FinishOut(BaseModel):
    session: SessionOut
    post: PostOut
    points: PointsResultOut
