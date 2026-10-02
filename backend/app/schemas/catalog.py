from pydantic import BaseModel

from app.schemas.common import PyObjectId


class FunctionOut(BaseModel):
    id: PyObjectId
    name: str
    code: str
    parent_id: PyObjectId | None


class CategoryOut(BaseModel):
    id: PyObjectId
    name: str
    code: str
    icon: str | None


class OnboardingOptionsOut(BaseModel):
    functions: list[FunctionOut]
    categories: list[CategoryOut]
    daily_target_min_minutes: int
    daily_target_default_minutes: int
