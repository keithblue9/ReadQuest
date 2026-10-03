from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import PyObjectId
from app.schemas.gamification import BadgeOut, QuestOut
from app.schemas.points import PointsResultOut
from app.schemas.posts import PostOut

NoteType = Literal["quick_note", "chapter_story", "book_review", "takeaway"]
SessionMode = Literal["standard", "micro"]
TakeawayKind = Literal["insight", "action", "quote"]


class SessionStartIn(BaseModel):
    book_id: PyObjectId
    # "micro" = sesi kilat (mis. 5 menit di jam istirahat); poinnya bertahap.
    mode: SessionMode = "standard"


class HeartbeatIn(BaseModel):
    state: Literal["active", "paused"]


class FinishIn(BaseModel):
    note_type: NoteType
    content: str = Field(min_length=1, max_length=10000)
    # Foto bukti baca wajib, kecuali Takeaway kilat (satu kalimat) agar cepat dikirim.
    image_keys: list[str] = Field(default_factory=list, max_length=4)
    takeaway_kind: TakeawayKind | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    current_page: int | None = Field(default=None, ge=0, le=10000)
    total_pages: int | None = Field(default=None, ge=1, le=10000)
    is_book_finished: bool = False
    pasted_chars: int = Field(default=0, ge=0)
    mention_ids: list[PyObjectId] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _pages(self) -> "FinishIn":
        if self.current_page and self.total_pages and self.current_page > self.total_pages:
            raise ValueError("Halaman saat ini melebihi total halaman")
        if not self.image_keys and self.note_type != "takeaway":
            raise ValueError("Tambahkan minimal satu foto halaman yang dibaca")
        if self.note_type != "takeaway":
            self.takeaway_kind = None
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
    mode: SessionMode = "standard"
    active_seconds: int
    min_seconds: int
    started_at: datetime
    ended_at: datetime | None
    local_date: str
    is_full_points: bool
    post_id: PyObjectId | None


class SessionConfigOut(BaseModel):
    min_seconds: int
    micro_min_seconds: int
    idle_timeout_seconds: int
    heartbeat_interval_seconds: int
    note_min_words: dict[str, int]
    note_min_unique_ratio: float
    note_max_paste_ratio: float


class TodayOut(BaseModel):
    local_date: str
    full_points_done: bool
    active_session: SessionOut | None
    # Menit sesi selesai hari ini (termasuk sesi kilat) menuju syarat poin penuh harian.
    minutes_today: int = 0
    min_minutes: int = 15


class FinishOut(BaseModel):
    session: SessionOut
    post: PostOut
    points: PointsResultOut
    badges: list[BadgeOut] = []
    quests_completed: list[QuestOut] = []
