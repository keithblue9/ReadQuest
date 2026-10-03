"""Konfigurasi tampilan yang diatur Admin: branding, background login, fitur/menu, dan teks UI.

Disimpan di `app_settings` dengan kunci `ui.<section>`. Default teks UI ada di frontend
(`src/lib/texts.ts`); backend hanya menyimpan teks yang diubah Admin (override).
"""

import re
import uuid
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock, media
from app.core.errors import AppError
from app.core.images import process_image
from app.core.storage import get_storage
from app.services import audit_service

# Fitur yang bisa dimatikan Admin (menu disembunyikan; push tidak dikirim).
FEATURES = ("feed", "books", "leaderboard", "quests", "buddy", "room", "book_of_month", "push")
# Menu navigasi utama yang urutannya bisa diatur.
MENUS = (
    "dashboard",
    "feed",
    "read",
    "books",
    "leaderboard",
    "quests",
    "buddy",
    "room",
    "notifications",
    "profile",
)

DEFAULTS: dict[str, dict] = {
    "branding": {
        "app_name": "ReadQuest",
        "tagline": "Baca 15 menit sehari, tumbuh bersama",
        "logo_emoji": "📚",
        "logo_key": None,
    },
    "login": {"background_keys": [], "interval_seconds": 6},
    "features": {"enabled": dict.fromkeys(FEATURES, True), "menu_order": list(MENUS)},
    "texts": {},
}
SECTIONS = tuple(DEFAULTS)

MAX_BACKGROUNDS = 12
MAX_TEXTS = 1000
MAX_TEXT_LENGTH = 500
MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_KINDS = {
    "background": {"prefix": "ui/backgrounds/", "max_dimension": 2400, "keep_alpha": False},
    "logo": {"prefix": "ui/logo/", "max_dimension": 512, "keep_alpha": True},
}
_TEXT_KEY = re.compile(r"^[a-z0-9_]+(\.[a-z0-9_]+)+$")


def _setting_key(section: str) -> str:
    return f"ui.{section}"


def _text(v: Any, field: str, lo: int, hi: int) -> str:
    if not isinstance(v, str) or not lo <= len(v.strip()) <= hi:
        raise ValueError(f"{field} harus teks {lo}–{hi} karakter")
    return v.strip()


def _image_key(v: Any, kind: str) -> str:
    prefix = IMAGE_KINDS[kind]["prefix"]
    if not isinstance(v, str) or not v.startswith(prefix) or ".." in v or len(v) > 200:
        raise ValueError("gambar tidak valid")
    return v


def _branding(v: Any) -> dict:
    if not isinstance(v, dict):
        raise ValueError("harus objek")
    logo_key = v.get("logo_key")
    return {
        "app_name": _text(v.get("app_name"), "Nama aplikasi", 1, 40),
        "tagline": _text(v.get("tagline", ""), "Slogan", 0, 120),
        "logo_emoji": _text(v.get("logo_emoji"), "Ikon", 1, 16),
        "logo_key": None if logo_key in (None, "") else _image_key(logo_key, "logo"),
    }


def _login(v: Any) -> dict:
    if not isinstance(v, dict):
        raise ValueError("harus objek")
    keys = v.get("background_keys")
    if not isinstance(keys, list) or len(keys) > MAX_BACKGROUNDS:
        raise ValueError(f"background maksimal {MAX_BACKGROUNDS} gambar")
    interval = v.get("interval_seconds")
    if isinstance(interval, bool) or not isinstance(interval, int) or not 3 <= interval <= 60:
        raise ValueError("durasi per gambar harus 3–60 detik")
    clean = [_image_key(k, "background") for k in keys]
    return {"background_keys": list(dict.fromkeys(clean)), "interval_seconds": interval}


def _features(v: Any) -> dict:
    if not isinstance(v, dict):
        raise ValueError("harus objek")
    enabled = v.get("enabled", {})
    if not isinstance(enabled, dict) or set(enabled) - set(FEATURES):
        raise ValueError(f"fitur yang dikenal: {', '.join(FEATURES)}")
    if not all(isinstance(x, bool) for x in enabled.values()):
        raise ValueError("status fitur harus true/false")
    order = v.get("menu_order", [])
    if not isinstance(order, list) or set(order) - set(MENUS):
        raise ValueError(f"menu yang dikenal: {', '.join(MENUS)}")
    # Menu yang tidak disebut tetap ada, ditaruh di akhir sesuai urutan default.
    menu_order = list(dict.fromkeys([*order, *MENUS]))
    return {"enabled": {f: enabled.get(f, True) for f in FEATURES}, "menu_order": menu_order}


def _texts(v: Any) -> dict:
    if not isinstance(v, dict) or len(v) > MAX_TEXTS:
        raise ValueError(f"maksimal {MAX_TEXTS} teks")
    out: dict[str, str] = {}
    for key, text in v.items():
        if not isinstance(key, str) or len(key) > 80 or not _TEXT_KEY.match(key):
            raise ValueError(f"kunci teks tidak valid: {str(key)[:80]}")
        if not isinstance(text, str) or len(text) > MAX_TEXT_LENGTH:
            raise ValueError(f"{key}: maksimal {MAX_TEXT_LENGTH} karakter")
        out[key] = text
    return out


VALIDATORS = {"branding": _branding, "login": _login, "features": _features, "texts": _texts}


async def _load(db: AsyncDatabase) -> tuple[dict[str, Any], Any]:
    keys = [_setting_key(s) for s in SECTIONS]
    rows = await db["app_settings"].find({"key": {"$in": keys}}).to_list()
    stored = {r["key"].removeprefix("ui."): r for r in rows}
    config: dict[str, Any] = {}
    for section, default in DEFAULTS.items():
        row = stored.get(section)
        try:
            config[section] = VALIDATORS[section](row["value"]) if row else default
        except ValueError:
            config[section] = default  # data rusak tidak boleh membuat aplikasi gagal tampil
    stamps = [r.get("updated_at") for r in rows if r.get("updated_at")]
    return config, max(stamps) if stamps else None


async def get_section(db: AsyncDatabase, section: str) -> Any:
    config, _ = await _load(db)
    return config[section]


async def branding(db: AsyncDatabase) -> dict:
    return await get_section(db, "branding")


def split_brand(name: str) -> tuple[str, str]:
    """Nama dua warna seperti di frontend: "ReadQuest" → ("Read", "Quest"), "Baca Yuk" → ("Baca ",
    "Yuk"), satu kata biasa → (nama, "")."""
    name = name.strip()
    if " " in name:
        head, _, tail = name.rpartition(" ")
        return f"{head} ", tail
    match = re.match(r"^(.*[a-z0-9])([A-Z][^A-Z]*)$", name)
    return (match.group(1), match.group(2)) if match else (name, "")


async def feature_enabled(db: AsyncDatabase, name: str) -> bool:
    features = await get_section(db, "features")
    return bool(features["enabled"].get(name, True))


async def public_config(db: AsyncDatabase) -> dict:
    """Konfigurasi untuk semua orang (termasuk halaman login): URL gambar sudah ditandatangani."""
    config, updated_at = await _load(db)
    branding = config["branding"]
    login = config["login"]
    return {
        "branding": {
            **branding,
            "logo_url": media.signed_url(branding["logo_key"]) if branding["logo_key"] else None,
        },
        "login": {
            "interval_seconds": login["interval_seconds"],
            "backgrounds": [
                {"key": key, "url": media.signed_url(key)} for key in login["background_keys"]
            ],
        },
        "features": config["features"],
        "texts": config["texts"],
        "updated_at": updated_at.isoformat() if updated_at else None,
    }


def _diff(before: dict, after: dict) -> tuple[dict, dict]:
    keys = {k for k in before.keys() | after.keys() if before.get(k) != after.get(k)}
    return {k: before.get(k) for k in keys}, {k: after.get(k) for k in keys}


async def update_section(
    db: AsyncDatabase, actor: dict, section: str, value: Any, meta: dict
) -> dict:
    validator = VALIDATORS.get(section)
    if validator is None:
        raise AppError(404, "unknown_section", "Bagian tampilan tidak dikenal")
    try:
        clean = validator(value)
    except ValueError as exc:
        raise AppError(422, "invalid_ui_config", str(exc)) from exc
    before = await get_section(db, section)
    await db["app_settings"].update_one(
        {"key": _setting_key(section)},
        {
            "$set": {"value": clean, "updated_by": actor["_id"], "updated_at": clock.now()},
            "$setOnInsert": {"description": f"Tampilan: {section}"},
        },
        upsert=True,
    )
    # Teks bisa ratusan entri: audit log hanya mencatat yang berubah.
    audit_before, audit_after = _diff(before, clean) if section == "texts" else (before, clean)
    await audit_service.log(
        db,
        actor=actor,
        action="ui.update",
        entity_type="app_settings",
        entity_id=_setting_key(section),
        before=audit_before,
        after=audit_after,
        **meta,
    )
    return await public_config(db)


async def store_image(kind: str, raw: bytes) -> dict:
    spec = IMAGE_KINDS.get(kind)
    if spec is None:
        raise AppError(422, "invalid_kind", "Jenis gambar harus background atau logo")
    if len(raw) > MAX_IMAGE_BYTES:
        limit_mb = MAX_IMAGE_BYTES // 2**20
        raise AppError(413, "file_too_large", f"Ukuran gambar maksimal {limit_mb} MB")
    image = process_image(raw, max_dimension=spec["max_dimension"], keep_alpha=spec["keep_alpha"])
    ext = "png" if image.content_type == "image/png" else "jpg"
    key = f"{spec['prefix']}{uuid.uuid4().hex}.{ext}"
    await get_storage().put(key, image.data, image.content_type)
    return {"key": key, "url": media.signed_url(key), "width": image.width, "height": image.height}
