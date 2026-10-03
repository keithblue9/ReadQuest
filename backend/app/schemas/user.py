from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import PyObjectId
from app.schemas.points import LevelOut


def validate_timezone(cls, v: str) -> str:
    try:
        ZoneInfo(v)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Zona waktu tidak dikenal") from exc
    return v


TargetMode = Literal["daily", "weekly"]


class RoleOut(BaseModel):
    code: str
    name: str


class UserStatsOut(BaseModel):
    points_total: int = 0
    books_finished: int = 0
    posts_count: int = 0
    current_streak: int = 0


class MeOut(BaseModel):
    id: PyObjectId
    phone: str | None = None
    email: str | None = None
    name: str
    avatar_url: str | None
    role: RoleOut
    permissions: list[str]
    function_id: PyObjectId | None
    interests: list[PyObjectId]
    daily_target_minutes: int
    target_mode: TargetMode = "daily"
    weekly_target_minutes: int
    headline: str = ""
    favorite_book_ids: list[PyObjectId] = []
    timezone: str
    onboarding_completed: bool
    stats: UserStatsOut
    level: LevelOut | None = None


class MeUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    timezone: str | None = None
    target_mode: TargetMode | None = None
    daily_target_minutes: int | None = Field(default=None, le=480)
    weekly_target_minutes: int | None = Field(default=None, ge=30, le=1200)
    # Profil publik: satu baris perkenalan + maksimal 3 buku favorit.
    headline: str | None = Field(default=None, max_length=120)
    favorite_book_ids: list[PyObjectId] | None = Field(default=None, max_length=3)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        return None if v is None else validate_timezone(cls, v)


class OnboardingIn(BaseModel):
    function_id: PyObjectId
    interests: list[PyObjectId] = Field(min_length=1, max_length=10)
    daily_target_minutes: int = Field(le=480)
    timezone: str

    _tz = field_validator("timezone")(validate_timezone)


class ProgressDayOut(BaseModel):
    date: str
    minutes: int


class ProgressOut(BaseModel):
    target_mode: TargetMode
    daily_target_minutes: int
    weekly_target_minutes: int
    today: str
    today_minutes: int
    week_minutes: int
    week_start: str
    week_end: str
    daily_met: bool
    weekly_met: bool
    days: list[ProgressDayOut]


class PublicBookOut(BaseModel):
    id: PyObjectId
    title: str
    authors: list[str]
    cover_url: str | None


class PublicStatsOut(BaseModel):
    points_total: int = 0
    books_finished: int = 0
    posts_count: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    reading_minutes: int = 0


class PublicBadgeOut(BaseModel):
    id: PyObjectId
    name: str
    icon: str
    description: str
    awarded_at: datetime


class PublicProfileOut(BaseModel):
    """Profil yang terlihat rekan setim. Status Authenticity Index tidak termasuk (privat)."""

    id: PyObjectId
    name: str
    avatar_url: str | None
    headline: str
    function: str | None
    role: str | None
    joined_at: datetime | None
    level: LevelOut | None
    stats: PublicStatsOut
    badges: list[PublicBadgeOut]
    favorite_books: list[PublicBookOut]
    currently_reading: list[PublicBookOut]
    shelf_counts: dict[str, int]
    is_me: bool
