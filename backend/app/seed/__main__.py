"""Seed data awal (idempotent): `uv run python -m app.seed`."""

import asyncio
from datetime import UTC, datetime

from pymongo.asynchronous.database import AsyncDatabase

from app.core import db as db_module
from app.core.config import get_settings
from app.core.phone_pin import normalize_phone
from app.core.security import hash_password
from app.repositories.indexes import ensure_indexes
from app.seed import data
from app.services.notification_service import DEFAULT_TEMPLATES


async def _upsert(db: AsyncDatabase, collection: str, key: dict, doc: dict) -> bool:
    """Insert bila belum ada; dokumen yang sudah ada (mungkin diubah Admin) tidak ditimpa."""
    now = datetime.now(UTC)
    result = await db[collection].update_one(
        key,
        {"$setOnInsert": {**key, **doc, "created_at": now, "updated_at": now}},
        upsert=True,
    )
    return result.upserted_id is not None


async def seed(db: AsyncDatabase) -> dict[str, int]:
    await ensure_indexes(db)
    created: dict[str, int] = {}

    async def count(collection: str, inserted: bool) -> None:
        created[collection] = created.get(collection, 0) + int(inserted)

    for code, group, description in data.PERMISSIONS:
        await count(
            "permissions",
            await _upsert(
                db, "permissions", {"code": code}, {"group": group, "description": description}
            ),
        )
    # Permission yang sudah dihapus dari katalog (mis. `invites.manage`) dibersihkan dari role.
    known = [c for c, _, _ in data.PERMISSIONS]
    await db["permissions"].delete_many({"code": {"$nin": known}})
    await db["roles"].update_many({}, {"$pull": {"permission_codes": {"$nin": known}}})
    for role in data.ROLES:
        doc = {k: v for k, v in role.items() if k != "code"}
        await count(
            "roles", await _upsert(db, "roles", {"code": role["code"]}, {**doc, "is_system": True})
        )
    # Permission baru selalu ditambahkan ke Admin; role lain tidak diubah (pilihan Admin dijaga).
    await db["roles"].update_one(
        {"code": "admin"},
        {"$addToSet": {"permission_codes": {"$each": [c for c, _, _ in data.PERMISSIONS]}}},
    )
    for rule in data.POINT_RULES:
        doc = {k: v for k, v in rule.items() if k != "code"}
        doc.setdefault("daily_cap_points", None)
        await count(
            "point_rules",
            await _upsert(
                db,
                "point_rules",
                {"code": rule["code"]},
                {**doc, "is_active": True, "updated_by": None},
            ),
        )
    for level in data.LEVELS:
        doc = {k: v for k, v in level.items() if k != "level"}
        await count(
            "levels", await _upsert(db, "levels", {"level": level["level"]}, {**doc, "icon": None})
        )
    for order, (code, name, icon) in enumerate(data.BOOK_CATEGORIES):
        await count(
            "book_categories",
            await _upsert(
                db,
                "book_categories",
                {"code": code},
                {"name": name, "icon": icon, "is_active": True, "sort_order": order},
            ),
        )
    for order, (code, name) in enumerate(data.FUNCTIONS):
        await count(
            "functions",
            await _upsert(
                db,
                "functions",
                {"code": code},
                {
                    "name": name,
                    "parent_id": None,
                    "ancestors": [],
                    "lead_user_ids": [],
                    "is_active": True,
                    "sort_order": order,
                },
            ),
        )
    for order, badge in enumerate(data.BADGES):
        doc = {k: v for k, v in badge.items() if k != "code"}
        await count(
            "badges",
            await _upsert(
                db, "badges", {"code": badge["code"]}, {**doc, "order": order, "is_active": True}
            ),
        )
    for order, quest in enumerate(data.QUESTS):
        doc = {k: v for k, v in quest.items() if k != "code"}
        await count(
            "quests",
            await _upsert(
                db,
                "quests",
                {"code": quest["code"]},
                {
                    **doc,
                    "period": "weekly",
                    "recurring": True,
                    "starts_at": None,
                    "ends_at": None,
                    "order": order,
                    "is_active": True,
                },
            ),
        )
    for type_, (title, body) in DEFAULT_TEMPLATES.items():
        await count(
            "notification_templates",
            await _upsert(
                db, "notification_templates", {"type": type_}, {"title": title, "body": body}
            ),
        )
    for key, value, description in data.APP_SETTINGS:
        await count(
            "app_settings",
            await _upsert(
                db,
                "app_settings",
                {"key": key},
                {"value": value, "description": description, "updated_by": None},
            ),
        )

    await _seed_admin(db, created)
    return created


async def _seed_admin(db: AsyncDatabase, created: dict[str, int]) -> None:
    """Admin pertama login dengan ADMIN_PHONE + ADMIN_PIN."""
    settings = get_settings()
    if not (settings.admin_phone and settings.admin_pin):
        return
    phone = normalize_phone(settings.admin_phone)
    if await db["users"].find_one({"phone": phone}, {"_id": 1}):
        return
    now = datetime.now(UTC)
    admin_role = await db["roles"].find_one({"code": "admin"})
    # Akun admin lama (login email) dimigrasikan: tambahkan nomor HP & PIN.
    legacy = (
        await db["users"].find_one({"email": settings.admin_email.lower(), "phone": None})
        if settings.admin_email
        else None
    )
    if legacy is not None:
        await db["users"].update_one(
            {"_id": legacy["_id"]},
            {
                "$set": {
                    "phone": phone,
                    "password_hash": hash_password(settings.admin_pin),
                    "updated_at": now,
                }
            },
        )
        print(f"Admin {settings.admin_email} kini login dengan nomor {phone}")
        return
    await db["users"].insert_one(
        {
            "phone": phone,
            "password_hash": hash_password(settings.admin_pin),
            "sso": None,
            "name": settings.admin_name,
            "avatar_url": None,
            "role_id": admin_role["_id"],
            "function_id": None,
            "interests": [],
            "daily_target_minutes": 15,
            "timezone": "Asia/Jakarta",
            "onboarding_completed_at": None,
            "stats": {
                "points_total": 0,
                "level_id": None,
                "books_finished": 0,
                "posts_count": 0,
                "current_streak": 0,
            },
            "status": "active",
            "login_failures": 0,
            "locked_until": None,
            "last_active_at": now,
            "created_at": now,
            "updated_at": now,
        }
    )
    created["users"] = 1
    print(f"Admin dibuat: {settings.admin_name} ({phone})")


async def main() -> None:
    await db_module.connect()
    try:
        created = await seed(db_module.get_db())
        summary = ", ".join(f"{k}+{v}" for k, v in created.items() if v) or "tidak ada data baru"
        print(f"Seed selesai ({get_settings().mongodb_db}): {summary}")
    finally:
        await db_module.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
