from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import PyObjectId
from app.schemas.posts import UserMiniOut

Category = Literal[
    "top_storyteller", "streak_master", "book_finisher", "most_inspiring", "function_battle"
]
Period = Literal["weekly", "monthly", "all_time"]


class FunctionRefOut(BaseModel):
    id: PyObjectId
    name: str


class LeaderboardEntryOut(BaseModel):
    rank: int
    score: float
    user: UserMiniOut | None = None
    function: FunctionRefOut | None = None
    detail: dict[str, float] = {}


class MyRankOut(BaseModel):
    rank: int
    score: float
    total_participants: int


class LeaderboardOut(BaseModel):
    category: Category
    period: Period
    period_key: str
    label: str
    is_final: bool
    prev_key: str | None = None
    next_key: str | None = None
    entries: list[LeaderboardEntryOut]
    me: MyRankOut | None
    computed_at: datetime


class LeaderboardSummaryItemOut(BaseModel):
    category: Category
    rank: int | None
    score: float
    total_participants: int
