from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PyObjectId


class AwardOut(BaseModel):
    rule_code: str
    name: str
    points: int


class LevelOut(BaseModel):
    level: int
    title: str
    min_points: int
    next_min_points: int | None
    next_title: str | None = None


class StreakOut(BaseModel):
    current: int
    longest: int
    milestone: int | None = None


class PointsResultOut(BaseModel):
    awarded: list[AwardOut]
    total_awarded: int
    points_total: int
    level: LevelOut | None
    level_up: bool
    streak: StreakOut


class StreakSummaryOut(BaseModel):
    current: int
    longest: int
    last_read_date: str | None
    read_today: bool
    next_milestone: int | None
    freezes_per_month: int = 0
    freezes_left: int = 0


class PointsSummaryOut(BaseModel):
    points_total: int
    points_today: int
    level: LevelOut | None
    streak: StreakSummaryOut


class LedgerEntryOut(BaseModel):
    id: PyObjectId
    rule_code: str
    name: str
    points: int
    source_type: str
    local_date: str
    note: str | None
    created_at: datetime


class LedgerPageOut(BaseModel):
    items: list[LedgerEntryOut]
    next_cursor: str | None
