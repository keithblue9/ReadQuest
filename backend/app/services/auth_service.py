import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import db as db_module
from app.core.config import get_settings
from app.core.errors import AppError, unauthorized
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.repositories import invite_codes, refresh_tokens, users
from app.schemas.auth import LoginIn, RegisterIn
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
    email = data.email.lower()
    if await users.find_by_email(db, email) is not None:
        raise AppError(409, "email_taken", "Email sudah terdaftar")

    _, default_target = await daily_target_bounds(db)
    now = datetime.now(UTC)
    # Kode undangan dipakai & user dibuat dalam satu transaksi: bila insert gagal,
    # used_count tidak ikut bertambah.
    async with db_module.get_client().start_session() as session:
        async with await session.start_transaction():
            invite = await invite_codes.consume(db, data.invite_code, session=session)
            if invite is None:
                raise AppError(
                    400, "invalid_invite_code", "Kode undangan tidak valid atau sudah habis"
                )
            doc = {
                "email": email,
                "password_hash": hash_password(data.password),
                "sso": None,
                "name": data.name,
                "avatar_url": None,
                "role_id": invite["default_role_id"],
                "function_id": invite.get("default_function_id"),
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
                "invite_code_id": invite["_id"],
                "last_active_at": now,
                "created_at": now,
                "updated_at": now,
            }
            try:
                doc["_id"] = await users.insert(db, doc, session=session)
            except DuplicateKeyError as exc:
                raise AppError(409, "email_taken", "Email sudah terdaftar") from exc
    return await _issue(db, doc, client)


async def login(db: AsyncDatabase, data: LoginIn, client: ClientInfo) -> IssuedTokens:
    user = await users.find_by_email(db, data.email)
    if not verify_password(data.password, user.get("password_hash") if user else None):
        raise unauthorized("Email atau password salah", code="invalid_credentials")
    if user["status"] != "active":
        raise AppError(403, "account_suspended", "Akun dinonaktifkan")
    await users.touch_last_active(db, user["_id"])
    return await _issue(db, user, client)


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
