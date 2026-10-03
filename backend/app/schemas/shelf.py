from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import PyObjectId

ShelfStatus = Literal["reading", "want", "finished"]


class ShelfIn(BaseModel):
    status: ShelfStatus


class ShelfBookOut(BaseModel):
    id: PyObjectId
    title: str
    authors: list[str]
    cover_url: str | None


class ShelfItemOut(BaseModel):
    book: ShelfBookOut
    status: ShelfStatus
    updated_at: datetime


class ShelfOut(BaseModel):
    items: list[ShelfItemOut]
    counts: dict[str, int]
