from datetime import datetime

from pydantic import BaseModel

from app.schemas.books import BookOut
from app.schemas.common import PyObjectId
from app.schemas.posts import UserMiniOut


class BadgeOut(BaseModel):
    id: PyObjectId
    code: str
    name: str
    description: str
    icon: str
    earned: bool = False
    awarded_at: datetime | None = None
    progress: int = 0
    target: int = 0


class QuestOut(BaseModel):
    id: PyObjectId
    code: str
    title: str
    description: str
    goal_type: str
    target: int
    progress: int
    completed: bool
    reward_points: int
    period_key: str
    ends_at: datetime | None


class BookOfMonthOut(BaseModel):
    month: str
    auto: bool
    book: BookOut | None
    readers_this_month: int = 0


class BuddyOut(BaseModel):
    pair_id: PyObjectId
    user: UserMiniOut
    read_today: bool
    streak: int
    since: datetime | None


class BuddyRequestOut(BaseModel):
    pair_id: PyObjectId
    user: UserMiniOut
    created_at: datetime


class BuddiesOut(BaseModel):
    buddy: BuddyOut | None
    incoming: list[BuddyRequestOut]
    outgoing: list[BuddyRequestOut]
