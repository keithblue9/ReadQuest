from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import PyObjectId

Status = Literal["active_reader", "warming_up", "observer", "silent"]


class AuthenticityOut(BaseModel):
    user_id: PyObjectId
    name: str
    function_id: PyObjectId | None
    window_days: int
    own_notes: int
    comments_given: int
    likes_given: int
    contribution_ratio: float
    status: Status
    status_label: str
    computed_at: datetime


class AuthenticityTeamOut(BaseModel):
    counts: dict[str, int]
    members: list[AuthenticityOut]
