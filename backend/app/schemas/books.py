from datetime import UTC, datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import PyObjectId


def _clean(value: str) -> str:
    return " ".join(value.split())


class BookCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    authors: list[str] = Field(min_length=1, max_length=5)
    category_id: PyObjectId
    publisher: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1000)
    total_pages: int | None = Field(default=None, ge=1, le=10000)
    isbn: str | None = Field(default=None, max_length=20)
    cover_image_key: str | None = Field(default=None, max_length=200)

    @field_validator("title", "publisher", "isbn")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = _clean(v)
        return v or None

    @field_validator("authors")
    @classmethod
    def _authors(cls, v: list[str]) -> list[str]:
        cleaned = [_clean(a) for a in v if _clean(a)]
        if not cleaned:
            raise ValueError("Pengarang wajib diisi")
        if any(len(a) > 120 for a in cleaned):
            raise ValueError("Nama pengarang terlalu panjang")
        return list(dict.fromkeys(cleaned))

    @field_validator("year")
    @classmethod
    def _year(cls, v: int | None) -> int | None:
        if v is not None and v > datetime.now(UTC).year + 1:
            raise ValueError("Tahun terbit tidak valid")
        return v


class CategoryRef(BaseModel):
    id: PyObjectId
    name: str
    icon: str | None


class BookStatsOut(BaseModel):
    readers_count: int = 0
    posts_count: int = 0
    avg_rating: float | None = None
    finished_count: int = 0


class BookOut(BaseModel):
    id: PyObjectId
    title: str
    authors: list[str]
    category: CategoryRef | None
    publisher: str | None
    year: int | None
    total_pages: int | None
    isbn: str | None
    cover_url: str | None
    stats: BookStatsOut
    created_at: datetime
