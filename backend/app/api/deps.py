from collections.abc import Awaitable, Callable
from datetime import UTC
from typing import Annotated

from bson import ObjectId
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase

from app.core.db import get_db
from app.core.errors import forbidden, unauthorized
from app.core.security import decode_access_token
from app.repositories import users
from app.services import permissions
from app.services.auth_service import ClientInfo

Db = Annotated[AsyncDatabase, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)


def client_info(request: Request) -> ClientInfo:
    ip = request.client.host if request.client else "unknown"
    return ClientInfo(ip=ip, user_agent=request.headers.get("user-agent", ""))


async def get_current_user(
    db: Db,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    if credentials is None:
        raise unauthorized()
    payload = decode_access_token(credentials.credentials)
    if payload is None or not ObjectId.is_valid(payload.get("sub", "")):
        raise unauthorized("Token tidak valid atau kedaluwarsa", code="token_invalid")
    user = await users.find_by_id(db, ObjectId(payload["sub"]))
    if user is None or user["status"] != "active":
        raise unauthorized("Token tidak valid atau kedaluwarsa", code="token_invalid")
    # Token yang terbit sebelum sesi dicabut (mis. PIN di-reset Admin) tidak berlaku lagi.
    revoked_at = user.get("sessions_revoked_at")
    if revoked_at is not None and payload.get("iat", 0) < int(
        revoked_at.replace(tzinfo=UTC).timestamp()
    ):
        raise unauthorized("Sesi berakhir, silakan login lagi", code="token_invalid")
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_permission(code: str) -> Callable[..., Awaitable[dict]]:
    """Dependency RBAC: user harus memiliki permission `code` dari role-nya."""

    async def _check(db: Db, user: CurrentUser) -> dict:
        role = await permissions.get_role(db, user["role_id"])
        if role is None or code not in role.get("permission_codes", []):
            raise forbidden()
        return user

    return _check
