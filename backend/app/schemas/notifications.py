from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import PyObjectId

NOTIFICATION_TYPES = [
    "reading_reminder",
    "streak_at_risk",
    "reaction",
    "comment",
    "mention",
    "weekly_leaderboard",
    "new_quest",
    "observer_nudge",
    "badge_awarded",
    "quest_completed",
    "buddy",
]
Frequency = Literal["realtime", "batched", "daily_digest"]


def _hhmm(value: str) -> str:
    hours, _, minutes = value.partition(":")
    if not (
        hours.isdigit() and minutes.isdigit() and 0 <= int(hours) < 24 and 0 <= int(minutes) < 60
    ):
        raise ValueError("Format jam harus HH:MM")
    return f"{int(hours):02d}:{int(minutes):02d}"


class ChannelPrefs(BaseModel):
    push: bool = True
    in_app: bool = True


class QuietHours(BaseModel):
    enabled: bool = True
    start: str = "21:00"
    end: str = "07:00"

    _v = field_validator("start", "end")(lambda cls, v: _hhmm(v))


class PreferencesOut(BaseModel):
    types: dict[str, ChannelPrefs]
    quiet_hours: QuietHours
    reminder_time: str
    digest_time: str
    frequency: Frequency
    # Pengingat cerdas: dikirim ±30 menit sebelum jam baca kebiasaanmu (bila sudah terbaca).
    smart_reminder: bool = True
    smart_reminder_time: str | None = None


class PreferencesIn(BaseModel):
    types: dict[str, ChannelPrefs] = Field(default_factory=dict)
    quiet_hours: QuietHours = QuietHours()
    reminder_time: str = "19:00"
    digest_time: str = "08:00"
    frequency: Frequency = "realtime"
    smart_reminder: bool = True

    _v = field_validator("reminder_time", "digest_time")(lambda cls, v: _hhmm(v))

    @field_validator("types")
    @classmethod
    def _known(cls, v: dict[str, ChannelPrefs]) -> dict[str, ChannelPrefs]:
        unknown = set(v) - set(NOTIFICATION_TYPES)
        if unknown:
            raise ValueError(f"Jenis notifikasi tidak dikenal: {', '.join(sorted(unknown))}")
        return v


class NotificationOut(BaseModel):
    id: PyObjectId
    type: str
    title: str
    body: str
    url: str | None
    actor_count: int
    read: bool
    created_at: datetime
    updated_at: datetime


class NotificationPageOut(BaseModel):
    items: list[NotificationOut]
    unread_count: int
    next_cursor: str | None


class MarkReadIn(BaseModel):
    ids: list[PyObjectId] = Field(default_factory=list, max_length=200)
    all: bool = False


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=10, max_length=200)
    auth: str = Field(min_length=10, max_length=100)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=2000)
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def _https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Endpoint push harus https")
        return v


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=2000)
