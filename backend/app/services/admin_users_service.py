"""Manajemen pengguna oleh Admin: daftar, ubah role/fungsi/status."""

import re
from datetime import UTC
from typing import Literal

from bson import ObjectId
from pydantic import BaseModel, field_validator
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.core.phone_pin import validate_pin
from app.schemas.common import PyObjectId
from app.services import audit_service, auth_service


class AdminUserUpdateIn(BaseModel):
    role_id: PyObjectId | None = None
    function_id: PyObjectId | None = None
    status: Literal["active", "suspended"] | None = None


class ResetPinIn(BaseModel):
    pin: str

    _pin = field_validator("pin")(lambda cls, v: validate_pin(v))


def _is_locked(user: dict) -> bool:
    until = user.get("locked_until")
    return bool(until and until.replace(tzinfo=UTC) > clock.now())


def _out(user: dict, roles: dict, functions: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "phone": user.get("phone"),
        "email": user.get("email"),
        "role": roles.get(user.get("role_id"), {}).get("name"),
        "role_id": str(user["role_id"]) if user.get("role_id") else None,
        "function": functions.get(user.get("function_id")),
        "function_id": str(user["function_id"]) if user.get("function_id") else None,
        "status": user.get("status", "active"),
        "locked": _is_locked(user),
        "points_total": (user.get("stats") or {}).get("points_total", 0),
        "last_active_at": user.get("last_active_at"),
        "created_at": user.get("created_at"),
    }


async def list_users(
    db: AsyncDatabase,
    *,
    q: str | None,
    role_id: ObjectId | None,
    function_id: ObjectId | None,
    status: str | None,
    skip: int,
    limit: int,
) -> dict:
    query: dict = {}
    if q:
        pattern = re.compile(re.escape(q.strip()), re.IGNORECASE)
        digits = re.sub(r"\D", "", q)
        query["$or"] = [{"name": pattern}, {"email": pattern}]
        if len(digits) >= 3:
            # "0812…" juga cocok dengan "+62812…"
            query["$or"].append({"phone": re.compile(re.escape(digits.lstrip("0")))})
    if role_id:
        query["role_id"] = role_id
    if function_id:
        query["function_id"] = function_id
    if status:
        query["status"] = status
    total = await db["users"].count_documents(query)
    rows = await db["users"].find(query).sort("name", 1).skip(skip).limit(limit).to_list()
    roles = {r["_id"]: r async for r in db["roles"].find()}
    functions = {f["_id"]: f["name"] async for f in db["functions"].find()}
    return {"total": total, "items": [_out(u, roles, functions) for u in rows]}


async def update_user(
    db: AsyncDatabase, actor: dict, user_id: ObjectId, data: AdminUserUpdateIn, meta: dict
) -> dict:
    user = await db["users"].find_one({"_id": user_id})
    if user is None:
        raise AppError(404, "user_not_found", "Pengguna tidak ditemukan")
    fields = data.model_dump(exclude_none=True)
    if user_id == actor["_id"] and ("status" in fields or "role_id" in fields):
        raise AppError(422, "self_change", "Tidak bisa mengubah role/status akun sendiri")
    if "role_id" in fields and await db["roles"].find_one({"_id": fields["role_id"]}) is None:
        raise AppError(422, "invalid_role", "Role tidak ditemukan")
    if (
        "function_id" in fields
        and await db["functions"].find_one({"_id": fields["function_id"]}) is None
    ):
        raise AppError(422, "invalid_function", "Fungsi tidak ditemukan")
    if fields:
        await db["users"].update_one(
            {"_id": user_id}, {"$set": {**fields, "updated_at": clock.now()}}
        )
        if fields.get("status") == "suspended":
            # Cabut semua sesi login agar langsung keluar.
            await db["refresh_tokens"].update_many(
                {"user_id": user_id, "revoked_at": None}, {"$set": {"revoked_at": clock.now()}}
            )
    after = await db["users"].find_one({"_id": user_id})
    await audit_service.log(
        db,
        actor=actor,
        action="user.update",
        entity_type="users",
        entity_id=user_id,
        before={k: user.get(k) for k in fields},
        after={k: after.get(k) for k in fields},
        **meta,
    )
    roles = {r["_id"]: r async for r in db["roles"].find()}
    functions = {f["_id"]: f["name"] async for f in db["functions"].find()}
    return _out(after, roles, functions)


async def reset_pin(
    db: AsyncDatabase, actor: dict, user_id: ObjectId, data: ResetPinIn, meta: dict
) -> None:
    if await db["users"].find_one({"_id": user_id}, {"_id": 1}) is None:
        raise AppError(404, "user_not_found", "Pengguna tidak ditemukan")
    await auth_service.set_pin(db, user_id, data.pin)
    await audit_service.log(
        db,
        actor=actor,
        action="user.reset_pin",
        entity_type="users",
        entity_id=user_id,
        after={"pin_reset": True},
        **meta,
    )
