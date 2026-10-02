import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.core.config import get_settings
from app.core.errors import AppError, unauthorized
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.repositories import catalog, refresh_tokens, users
from app.schemas.auth import ChangePinIn, LoginIn, RegisterIn
from app.services import permissions
from app.services.user_service import daily_target_bounds


@dataclass
class IssuedTokens:
    user: dict
    access_token: str
    expires_in: int
    refresh_token: str


@dataclass
class ClientInfo:
    ip: str
    user_agent: str


async def _issue(
    db: AsyncDatabase, user: dict, client: ClientInfo, family_id: str | None = None
) -> IssuedTokens:
    role = await permissions.get_role(db, user["role_id"])
    access, expires_in = create_access_token(str(user["_id"]), role["code"] if role else "")
    refresh = new_refresh_token()
    settings = get_settings()
    await refresh_tokens.insert(
        db,
        user_id=user["_id"],
        token_hash=hash_token(refresh),
        family_id=family_id or uuid.uuid4().hex,
        expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_ttl_days),
        user_agent=client.user_agent[:256],
        ip=client.ip,
    )
    return IssuedTokens(user, access, expires_in, refresh)


async def register(db: AsyncDatabase, data: RegisterIn, client: ClientInfo) -> IssuedTokens:
    if await users.find_by_phone(db, data.phone) is not None:
        raise AppError(409, "phone_taken", "Nomor HP sudah terdaftar")
    if await catalog.get_active_function(db, data.function_id) is None:
        raise AppError(422, "invalid_function", "Fungsi/bagian tidak ditemukan")
    member = await catalog.get_role_by_code(db, "member")
    if member is None:
        raise AppError(500, "role_missing", "Role Member belum tersedia, jalankan seed")

    _, default_target = await daily_target_bounds(db)
    now = datetime.now(UTC)
    doc = {
        "phone": data.phone,
        # PIN 6 angka di-hash argon2 (nama field tetap `password_hash`).
        "password_hash": hash_password(data.pin),
        "sso": None,
        "name": data.name,
        "avatar_url": None,
        "role_id": member["_id"],
        "function_id": data.function_id,
        "interests": [],
        "daily_target_minutes": default_target,
        "timezone": data.timezone,
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
    try:
        doc["_id"] = await users.insert(db, doc)
    except DuplicateKeyError as exc:
        raise AppError(409, "phone_taken", "Nomor HP sudah terdaftar") from exc
    return await _issue(db, doc, client)


async def _lockout_policy(db: AsyncDatabase) -> tuple[int, int]:
    attempts = await catalog.get_setting(db, "auth.max_pin_attempts", 5)
    minutes = await catalog.get_setting(db, "auth.lockout_minutes", 15)
    return int(attempts), int(minutes)


def _locked_error(until: datetime) -> AppError:
    minutes = max(1, int((until - clock.now()).total_seconds() // 60) + 1)
    return AppError(
        429,
        "account_locked",
        f"Terlalu banyak PIN salah. Coba lagi dalam {minutes} menit atau minta Admin reset PIN.",
    )


async def login(db: AsyncDatabase, data: LoginIn, client: ClientInfo) -> IssuedTokens:
    user = await users.find_by_phone(db, data.phone)
    locked_until = user.get("locked_until") if user else None
    if locked_until is not None and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    if locked_until is not None and locked_until > clock.now():
        raise _locked_error(locked_until)
    if not verify_password(data.pin, user.get("password_hash") if user else None):
        if user is not None:
            await _register_failure(db, user)
        raise unauthorized("Nomor HP atau PIN salah", code="invalid_credentials")
    if user["status"] != "active":
        raise AppError(403, "account_suspended", "Akun dinonaktifkan")
    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"login_failures": 0, "locked_until": None, "last_active_at": clock.now()}},
    )
    return await _issue(db, user, client)


async def _register_failure(db: AsyncDatabase, user: dict) -> None:
    max_attempts, lock_minutes = await _lockout_policy(db)
    updated = await db["users"].find_one_and_update(
        {"_id": user["_id"]},
        {"$inc": {"login_failures": 1}},
        return_document=True,
    )
    if updated and updated.get("login_failures", 0) >= max_attempts:
        until = clock.now() + timedelta(minutes=lock_minutes)
        await db["users"].update_one(
            {"_id": user["_id"]}, {"$set": {"login_failures": 0, "locked_until": until}}
        )
        raise _locked_error(until)


async def change_pin(db: AsyncDatabase, user: dict, data: ChangePinIn) -> None:
    if not verify_password(data.current_pin, user.get("password_hash")):
        raise AppError(422, "invalid_pin", "PIN saat ini salah")
    await users.update(db, user["_id"], {"password_hash": hash_password(data.new_pin)})


async def set_pin(db: AsyncDatabase, user_id, pin: str) -> None:
    """Dipakai Admin (reset PIN): buka kunci & cabut semua sesi login."""
    await users.update(
        db,
        user_id,
        {
            "password_hash": hash_password(pin),
            "login_failures": 0,
            "locked_until": None,
            "sessions_revoked_at": clock.now(),
        },
    )
    await db["refresh_tokens"].update_many(
        {"user_id": user_id, "revoked_at": None}, {"$set": {"revoked_at": clock.now()}}
    )


async def refresh(db: AsyncDatabase, token: str | None, client: ClientInfo) -> IssuedTokens:
    if not token:
        raise unauthorized("Sesi berakhir, silakan login lagi", code="refresh_invalid")
    token_hash = hash_token(token)
    stored = await refresh_tokens.find_by_hash(db, token_hash)
    if stored is None:
        raise unauthorized("Sesi berakhir, silakan login lagi", code="refresh_invalid")

    if stored["expires_at"] <= datetime.now(UTC):
        raise unauthorized("Sesi berakhir, silakan login lagi", code="refresh_invalid")

    rotated = await refresh_tokens.revoke_if_active(db, token_hash)
    if rotated is None:
        # Token yang sudah dirotasi dipakai lagi → kemungkinan dicuri: cabut seluruh family.
        await refresh_tokens.revoke_family(db, stored["family_id"])
        raise unauthorized("Sesi tidak valid, silakan login lagi", code="refresh_reused")

    user = await users.find_by_id(db, stored["user_id"])
    if user is None or user["status"] != "active":
        await refresh_tokens.revoke_family(db, stored["family_id"])
        raise unauthorized("Sesi berakhir, silakan login lagi", code="refresh_invalid")
    await users.touch_last_active(db, user["_id"])
    return await _issue(db, user, client, family_id=stored["family_id"])


async def logout(db: AsyncDatabase, token: str | None) -> None:
    if not token:
        return
    stored = await refresh_tokens.find_by_hash(db, hash_token(token))
    if stored is not None:
        await refresh_tokens.revoke_family(db, stored["family_id"])
