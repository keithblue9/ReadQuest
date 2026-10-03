"""Notifikasi: template data-driven, preferensi per user, batching, jam tenang, dan inbox in-app.

Alur: `notify()` membuat/menggabungkan dokumen `notifications` → push dikirim belakangan oleh
`push_service.dispatch_due()` (dijalankan scheduler) saat `deliver_after` tercapai.
"""

from datetime import UTC, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.schemas.notifications import (
    NOTIFICATION_TYPES,
    ChannelPrefs,
    MarkReadIn,
    NotificationOut,
    NotificationPageOut,
    PreferencesIn,
    PreferencesOut,
    QuietHours,
)
from app.services import ui_config_service

BATCH_WINDOW = timedelta(minutes=5)
BATCH_MAX_AGE = timedelta(hours=12)

# Jenis notifikasi → kunci preferensi yang mengaturnya.
PREFERENCE_KEY = {
    "reply": "comment",
    "buddy_request": "buddy",
    "buddy_accepted": "buddy",
    "buddy_cheer": "buddy",
}

DEFAULT_TEMPLATES: dict[str, tuple[str, str]] = {
    "reading_reminder": (
        "Waktunya membaca 📖",
        "Target harianmu {minutes} menit. Yuk mulai sesi baca hari ini!",
    ),
    "streak_at_risk": (
        "Streak {streak} harimu terancam 🔥",
        "Baca 15 menit sebelum tengah malam agar streak tidak putus.",
    ),
    "reaction": ("{actors} mengapresiasi catatanmu ✨", "“{excerpt}”"),
    "comment": ("{actor} mengomentari catatanmu 💬", "“{excerpt}”"),
    "reply": ("{actor} membalas komentarmu 💬", "“{excerpt}”"),
    "mention": ("{actor} menyebutmu 📣", "“{excerpt}”"),
    "weekly_leaderboard": ("Peringkat minggu lalu 🏆", "{summary}"),
    "new_quest": (
        "Quest minggu ini sudah tersedia 🎯",
        "{count} tantangan baru menunggumu. Selesaikan untuk poin bonus!",
    ),
    "observer_nudge": (
        "Ceritamu ditunggu, lho! 📖",
        "Kamu aktif menyemangati rekan. Yuk bagikan satu catatan bacaan minggu ini — "
        "cukup 15 menit membaca dan beberapa kalimat.",
    ),
    "badge_awarded": ("Badge baru: {name} {icon}", "{description}"),
    "quest_completed": ("Quest selesai: {title} 🎯", "{reward}"),
    "buddy_request": (
        "{actor} mengajakmu jadi Reading Buddy 🤝",
        "Saling menyemangati agar rutin membaca setiap hari.",
    ),
    "buddy_accepted": (
        "{actor} kini Reading Buddy-mu 🎉",
        "Yuk saling semangati membaca hari ini!",
    ),
    "buddy_cheer": (
        "{actor} menyemangatimu 📣",
        "Ayo baca 15 menit hari ini, buddy-mu menunggu ceritamu!",
    ),
}


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _render(text: str, context: dict[str, Any]) -> str:
    return text.format_map(_SafeDict({k: v for k, v in context.items() if v is not None}))


async def template(db: AsyncDatabase, type_: str) -> tuple[str, str]:
    doc = await db["notification_templates"].find_one({"type": type_})
    if doc:
        return doc["title"], doc["body"]
    return DEFAULT_TEMPLATES.get(type_, ("ReadQuest", ""))


def excerpt(text: str, limit: int = 90) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def actors_label(names: list[str]) -> str:
    if not names:
        return "Seseorang"
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} dan {names[1]}"
    return f"{names[0]} dan {len(names) - 1} lainnya"


# ---------- Preferensi ----------


def _defaults() -> PreferencesOut:
    return PreferencesOut(
        types={t: ChannelPrefs() for t in NOTIFICATION_TYPES},
        quiet_hours=QuietHours(),
        reminder_time="19:00",
        digest_time="08:00",
        frequency="realtime",
    )


async def get_preferences(db: AsyncDatabase, user_id: ObjectId) -> PreferencesOut:
    prefs = _defaults()
    doc = await db["notification_preferences"].find_one({"user_id": user_id})
    if not doc:
        return prefs
    for key, value in (doc.get("types") or {}).items():
        if key in prefs.types:
            prefs.types[key] = ChannelPrefs(**value)
    if doc.get("quiet_hours"):
        prefs.quiet_hours = QuietHours(**doc["quiet_hours"])
    prefs.reminder_time = doc.get("reminder_time", prefs.reminder_time)
    prefs.digest_time = doc.get("digest_time", prefs.digest_time)
    prefs.frequency = doc.get("frequency", prefs.frequency)
    prefs.smart_reminder = doc.get("smart_reminder", True)
    return prefs


async def save_preferences(
    db: AsyncDatabase, user_id: ObjectId, data: PreferencesIn
) -> PreferencesOut:
    current = await get_preferences(db, user_id)
    types = {**current.types, **data.types}
    await db["notification_preferences"].update_one(
        {"user_id": user_id},
        {
            "$set": {
                "types": {k: v.model_dump() for k, v in types.items()},
                "quiet_hours": data.quiet_hours.model_dump(),
                "reminder_time": data.reminder_time,
                "digest_time": data.digest_time,
                "frequency": data.frequency,
                "smart_reminder": data.smart_reminder,
                "updated_at": clock.now(),
            }
        },
        upsert=True,
    )
    return await get_preferences(db, user_id)


# ---------- Pengingat cerdas ----------

HABIT_LOOKBACK = timedelta(days=28)
HABIT_MIN_SESSIONS = 3
HABIT_LEAD_MINUTES = 30
HABIT_EARLIEST = 6 * 60
HABIT_LATEST = 22 * 60


def habit_time_from(starts_local_minutes: list[int]) -> str | None:
    """Median jam mulai baca − 30 menit, dibulatkan ke bawah per 15 menit (06:00–22:00)."""
    if len(starts_local_minutes) < HABIT_MIN_SESSIONS:
        return None
    ordered = sorted(starts_local_minutes)
    median = ordered[len(ordered) // 2]
    minutes = max(HABIT_EARLIEST, min(HABIT_LATEST, median - HABIT_LEAD_MINUTES))
    minutes -= minutes % 15
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


async def habit_reminder_time(db: AsyncDatabase, user: dict) -> str | None:
    """Jam pengingat dari kebiasaan baca 4 minggu terakhir; dihitung sekali per hari (cache di
    dokumen user) karena job pengingat berjalan tiap menit."""
    tz = ZoneInfo(user.get("timezone", "Asia/Jakarta"))
    now = clock.now()
    today = now.astimezone(tz).date().isoformat()
    cached = user.get("reading_habit") or {}
    if cached.get("date") == today:
        return cached.get("time")
    starts = [
        s["started_at"].replace(tzinfo=UTC).astimezone(tz)
        async for s in db["reading_sessions"].find(
            {
                "user_id": user["_id"],
                "status": "completed",
                "started_at": {"$gte": now - HABIT_LOOKBACK},
            },
            {"started_at": 1},
        )
    ]
    habit = habit_time_from([s.hour * 60 + s.minute for s in starts])
    await db["users"].update_one(
        {"_id": user["_id"]}, {"$set": {"reading_habit": {"date": today, "time": habit}}}
    )
    return habit


def _parse(hhmm: str) -> time:
    hours, minutes = hhmm.split(":")
    return time(int(hours), int(minutes))


def in_quiet_hours(local: datetime, quiet: QuietHours) -> bool:
    if not quiet.enabled:
        return False
    start, end, now = _parse(quiet.start), _parse(quiet.end), local.time()
    if start == end:
        return False
    if start < end:
        return start <= now < end
    return now >= start or now < end  # melewati tengah malam


def _next_at(local: datetime, hhmm: str) -> datetime:
    target = datetime.combine(local.date(), _parse(hhmm), local.tzinfo)
    return target if target > local else target + timedelta(days=1)


def deliver_after(base: datetime, prefs: PreferencesOut, timezone: str) -> datetime:
    """Kapan push boleh dikirim, memperhitungkan frekuensi & jam tenang (zona waktu user)."""
    zone = ZoneInfo(timezone)
    local = base.astimezone(zone)
    if prefs.frequency == "batched":
        local = (local + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    elif prefs.frequency == "daily_digest":
        local = _next_at(local, prefs.digest_time)
    if in_quiet_hours(local, prefs.quiet_hours):
        local = _next_at(local, prefs.quiet_hours.end)
    return local.astimezone(base.tzinfo)


# ---------- Membuat notifikasi ----------


async def notify(
    db: AsyncDatabase,
    *,
    user_id: ObjectId,
    type_: str,
    context: dict[str, Any] | None = None,
    url: str | None = None,
    actor: dict | None = None,
    group_key: str | None = None,
    batch: bool = False,
) -> ObjectId | None:
    """Buat notifikasi sesuai template & preferensi. Bila `batch`, notifikasi belum dibaca dengan
    `group_key` yang sama digabung (mis. "Rani dan 3 lainnya mengapresiasi catatanmu")."""
    if actor and actor["_id"] == user_id:
        return None
    user = await db["users"].find_one({"_id": user_id, "status": "active"}, {"timezone": 1})
    if user is None:
        return None
    prefs = await get_preferences(db, user_id)
    channel = prefs.types.get(PREFERENCE_KEY.get(type_, type_), ChannelPrefs())
    # Admin bisa mematikan Web Push untuk seluruh tim (fitur "push" di menu Tampilan).
    if channel.push and not await ui_config_service.feature_enabled(db, "push"):
        channel = channel.model_copy(update={"push": False})
    if not channel.in_app and not channel.push:
        return None

    now = clock.now()
    context = dict(context or {})
    title_tpl, body_tpl = await template(db, type_)
    actor_ids: list[ObjectId] = [actor["_id"]] if actor else []
    if actor:
        context.setdefault("actor", actor["name"])

    existing = None
    if batch and group_key:
        existing = await db["notifications"].find_one(
            {
                "user_id": user_id,
                "group_key": group_key,
                "read_at": None,
                "created_at": {"$gte": now - BATCH_MAX_AGE},
            }
        )
    if existing:
        actor_ids = list(dict.fromkeys([*actor_ids, *existing.get("actor_ids", [])]))
    if actor_ids:
        names = {
            u["_id"]: u["name"]
            async for u in db["users"].find({"_id": {"$in": actor_ids}}, {"name": 1})
        }
        context["actors"] = actors_label([names[a] for a in actor_ids if a in names])

    fields = {
        "title": _render(title_tpl, context),
        "body": _render(body_tpl, context),
        "actor_ids": actor_ids,
        "in_app": channel.in_app,
        "updated_at": now,
    }
    timezone = user.get("timezone", "Asia/Jakarta")
    push_status = "pending" if channel.push else "skipped"
    delay = BATCH_WINDOW if batch else timedelta(0)

    if existing:
        update: dict[str, Any] = {**fields}
        if existing.get("push_status") != "pending" and channel.push:
            update["push_status"] = "pending"
            update["deliver_after"] = deliver_after(now + delay, prefs, timezone)
        await db["notifications"].update_one({"_id": existing["_id"]}, {"$set": update})
        return existing["_id"]

    doc = {
        "user_id": user_id,
        "type": type_,
        "data": {"url": url} if url else {},
        "group_key": group_key,
        "read_at": None,
        "push_status": push_status,
        "deliver_after": deliver_after(now + delay, prefs, timezone),
        "created_at": now,
        **fields,
    }
    return (await db["notifications"].insert_one(doc)).inserted_id


# ---------- Inbox in-app ----------


def to_out(doc: dict) -> NotificationOut:
    return NotificationOut(
        id=doc["_id"],
        type=doc["type"],
        title=doc["title"],
        body=doc["body"],
        url=(doc.get("data") or {}).get("url"),
        actor_count=len(doc.get("actor_ids", [])),
        read=doc.get("read_at") is not None,
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at", doc["created_at"]),
    )


async def unread_count(db: AsyncDatabase, user_id: ObjectId) -> int:
    return await db["notifications"].count_documents(
        {"user_id": user_id, "read_at": None, "in_app": {"$ne": False}}
    )


async def inbox(
    db: AsyncDatabase, user_id: ObjectId, cursor: str | None, limit: int
) -> NotificationPageOut:
    query: dict[str, Any] = {"user_id": user_id, "in_app": {"$ne": False}}
    if cursor:
        if not ObjectId.is_valid(cursor):
            raise AppError(400, "invalid_cursor", "Cursor tidak valid")
        query["_id"] = {"$lt": ObjectId(cursor)}
    rows = await db["notifications"].find(query).sort("_id", -1).limit(limit + 1).to_list()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return NotificationPageOut(
        items=[to_out(r) for r in rows],
        unread_count=await unread_count(db, user_id),
        next_cursor=str(rows[-1]["_id"]) if has_more and rows else None,
    )


async def mark_read(db: AsyncDatabase, user_id: ObjectId, data: MarkReadIn) -> int:
    query: dict[str, Any] = {"user_id": user_id, "read_at": None}
    if not data.all:
        if not data.ids:
            return await unread_count(db, user_id)
        query["_id"] = {"$in": data.ids}
    await db["notifications"].update_many(query, {"$set": {"read_at": clock.now()}})
    return await unread_count(db, user_id)
