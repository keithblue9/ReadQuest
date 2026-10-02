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
    email: str
    name: str
    avatar_url: str | None
    role: RoleOut
    permissions: list[str]
    function_id: PyObjectId | None
    interests: list[PyObjectId]
    daily_target_minutes: int
    timezone: str
    onboarding_completed: bool
    stats: UserStatsOut
    level: LevelOut | None = None


class MeUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    timezone: str | None = None

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
