"""Pengaturan aplikasi (app_settings) dengan validasi per kunci."""

from collections.abc import Callable
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.repositories import leaderboard_cache
from app.services import audit_service


def _int(lo: int, hi: int) -> Callable[[Any], int]:
    def check(v: Any) -> int:
        if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
            raise ValueError(f"harus bilangan bulat {lo}–{hi}")
        return v

    return check


def _ratio(v: Any) -> float:
    if isinstance(v, bool) or not isinstance(v, int | float) or not 0 <= v <= 1:
        raise ValueError("harus angka 0–1")
    return float(v)


def _hhmm(v: Any) -> str:
    if not isinstance(v, str) or len(v) != 5 or v[2] != ":":
        raise ValueError("format jam HH:MM")
    h, m = v.split(":")
    if not (h.isdigit() and m.isdigit() and int(h) < 24 and int(m) < 60):
        raise ValueError("format jam HH:MM")
    return v


def _min_words(v: Any) -> dict:
    if not isinstance(v, dict) or set(v) != {"quick_note", "chapter_story", "book_review"}:
        raise ValueError("butuh quick_note, chapter_story, book_review")
    return {k: _int(5, 2000)(x) for k, x in v.items()}


def _thresholds(v: Any) -> dict:
    if not isinstance(v, dict) or set(v) != {"active_reader", "warming_up", "observer"}:
        raise ValueError("butuh active_reader, warming_up, observer")
    t = {k: _ratio(x) for k, x in v.items()}
    if not t["active_reader"] > t["warming_up"] >= t["observer"]:
        raise ValueError("urutan harus active_reader > warming_up >= observer")
    return t


def _timezone(v: Any) -> str:
    try:
        ZoneInfo(str(v))
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("zona waktu tidak dikenal") from exc
    return str(v)


def _schedule(v: Any) -> dict:
    if not isinstance(v, dict):
        raise ValueError("harus objek")
    out = {
        "streak_risk_time": _hhmm(v.get("streak_risk_time")),
        "authenticity_time": _hhmm(v.get("authenticity_time")),
    }
    for key in ("weekly_leaderboard", "new_quest"):
        item = v.get(key) or {}
        out[key] = {"weekday": _int(0, 6)(item.get("weekday")), "time": _hhmm(item.get("time"))}
    return out


VALIDATORS: dict[str, Callable[[Any], Any]] = {
    "session.min_minutes": _int(5, 120),
    "session.idle_timeout_seconds": _int(60, 3600),
    "session.heartbeat_max_gap_seconds": _int(20, 300),
    "note.min_words": _min_words,
    "note.min_unique_word_ratio": _ratio,
    "note.max_paste_ratio": _ratio,
    "comment.meaningful_min_words": _int(1, 100),
    "authenticity.thresholds": _thresholds,
    "upload.max_bytes": _int(100_000, 10_000_000),
    "onboarding.default_daily_target_minutes": _int(5, 480),
    "team.timezone": _timezone,
    "leaderboard.cache_seconds": _int(0, 3600),
    "notifications.schedule": _schedule,
    "auth.max_pin_attempts": _int(3, 20),
    "auth.lockout_minutes": _int(1, 1440),
}


async def list_settings(db: AsyncDatabase) -> list[dict]:
    rows = await db["app_settings"].find().sort("key", 1).to_list()
    return [
        {"key": r["key"], "value": r["value"], "description": r.get("description", "")}
        for r in rows
        if r["key"] in VALIDATORS
    ]


async def update_setting(db: AsyncDatabase, actor: dict, key: str, value: Any, meta: dict) -> dict:
    validator = VALIDATORS.get(key)
    if validator is None:
        raise AppError(404, "unknown_setting", "Pengaturan tidak dikenal")
    try:
        clean = validator(value)
    except ValueError as exc:
        raise AppError(422, "invalid_setting", f"{key}: {exc}") from exc
    before = await db["app_settings"].find_one({"key": key})
    await db["app_settings"].update_one(
        {"key": key},
        {"$set": {"value": clean, "updated_by": actor["_id"], "updated_at": clock.now()}},
        upsert=True,
    )
    if key in {"team.timezone", "leaderboard.cache_seconds"}:
        await leaderboard_cache.invalidate_open(db)
    await audit_service.log(
        db,
        actor=actor,
        action="setting.update",
        entity_type="app_settings",
        entity_id=key,
        before={"value": before["value"]} if before else None,
        after={"value": clean},
        **meta,
    )
    return {"key": key, "value": clean, "description": (before or {}).get("description", "")}
