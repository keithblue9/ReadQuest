"""Konfigurasi data-driven untuk Admin: registry resource CRUD generik + validasi per resource.

Setiap perubahan tercatat di audit log. Resource dengan logika khusus (pengguna, pengaturan,
moderasi) punya service sendiri.
"""

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from pydantic import BaseModel, Field, field_validator
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.core.errors import AppError
from app.schemas.common import PyObjectId
from app.services import audit_service, permissions, user_stats
from app.services.notification_service import DEFAULT_TEMPLATES

SLUG_RE = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")


def _slug(v: str) -> str:
    v = v.strip().lower()
    if not SLUG_RE.match(v):
        raise ValueError("Kode hanya huruf kecil, angka, dan tanda hubung")
    return v


# ---------- Skema input ----------


class FunctionIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=2, max_length=40)
    parent_id: PyObjectId | None = None
    lead_user_ids: list[PyObjectId] = Field(default_factory=list, max_length=20)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=9999)
    _c = field_validator("code")(lambda cls, v: _slug(v))


class RoleIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=60)
    description: str = Field(default="", max_length=200)
    permission_codes: list[str] = Field(default_factory=list, max_length=100)
    _c = field_validator("code")(lambda cls, v: _slug(v))


class PointRuleIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    points: int = Field(ge=0, le=10000)
    daily_cap_count: int | None = Field(default=None, ge=1, le=1000)
    daily_cap_points: int | None = Field(default=None, ge=1, le=100000)
    is_active: bool = True


def _metric(v: str) -> str:
    if v not in user_stats.METRICS:
        raise ValueError(f"Metrik harus salah satu dari: {', '.join(user_stats.METRICS)}")
    return v


class Criteria(BaseModel):
    type: str
    gte: int = Field(ge=1, le=100000)
    _m = field_validator("type")(lambda cls, v: _metric(v))


class BadgeIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=60)
    description: str = Field(default="", max_length=200)
    icon: str = Field(default="🏅", min_length=1, max_length=8)
    criteria: Criteria
    is_active: bool = True
    order: int = Field(default=0, ge=0, le=9999)
    _c = field_validator("code")(lambda cls, v: _slug(v))


class Goal(BaseModel):
    type: str
    target: int = Field(ge=1, le=100000)
    _m = field_validator("type")(lambda cls, v: _metric(v))


class Reward(BaseModel):
    points: int = Field(default=0, ge=0, le=1000)


class QuestIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=200)
    period: Literal["weekly", "monthly", "once"] = "weekly"
    recurring: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    goal: Goal
    reward: Reward = Reward()
    is_active: bool = True
    order: int = Field(default=0, ge=0, le=9999)
    _c = field_validator("code")(lambda cls, v: _slug(v))


class LevelIn(BaseModel):
    level: int = Field(ge=1, le=1000)
    title: str = Field(min_length=2, max_length=60)
    min_points: int = Field(ge=0, le=10_000_000)
    icon: str | None = Field(default=None, max_length=8)


class CategoryIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=60)
    icon: str | None = Field(default=None, max_length=8)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=9999)
    _c = field_validator("code")(lambda cls, v: _slug(v))


class TemplateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=500)


# ---------- Hook validasi ----------


async def _validate_function(db: AsyncDatabase, data: dict, existing: dict | None) -> dict:
    parent_id = data.get("parent_id")
    ancestors: list[ObjectId] = []
    if parent_id:
        parent = await db["functions"].find_one({"_id": parent_id})
        if parent is None:
            raise AppError(422, "invalid_parent", "Fungsi induk tidak ditemukan")
        if existing and (
            parent_id == existing["_id"] or existing["_id"] in parent.get("ancestors", [])
        ):
            raise AppError(
                422, "invalid_parent", "Fungsi tidak boleh menjadi induk dirinya sendiri"
            )
        ancestors = [*parent.get("ancestors", []), parent_id]
    leads = data.get("lead_user_ids", [])
    if leads and await db["users"].count_documents({"_id": {"$in": leads}}) != len(set(leads)):
        raise AppError(422, "invalid_lead", "Team Lead tidak ditemukan")
    return {**data, "ancestors": ancestors}


async def _after_function(db: AsyncDatabase, doc: dict) -> None:
    """Perbarui `ancestors` seluruh sub-fungsi setelah induk berubah."""
    queue = [doc]
    while queue:
        node = queue.pop()
        async for child in db["functions"].find({"parent_id": node["_id"]}):
            ancestors = [*node.get("ancestors", []), node["_id"]]
            await db["functions"].update_one(
                {"_id": child["_id"]}, {"$set": {"ancestors": ancestors}}
            )
            queue.append({**child, "ancestors": ancestors})


async def _validate_role(db: AsyncDatabase, data: dict, existing: dict | None) -> dict:
    catalog = {p["code"] async for p in db["permissions"].find({}, {"code": 1})}
    unknown = set(data.get("permission_codes", [])) - catalog
    if unknown:
        raise AppError(
            422, "invalid_permission", f"Permission tidak dikenal: {', '.join(sorted(unknown))}"
        )
    if existing and existing.get("is_system"):
        if data["code"] != existing["code"]:
            raise AppError(422, "system_role", "Kode role bawaan tidak bisa diubah")
        if existing["code"] == "admin" and "config.roles.manage" not in data["permission_codes"]:
            raise AppError(422, "lockout", "Role Admin harus tetap bisa mengelola role")
    data["permission_codes"] = sorted(set(data.get("permission_codes", [])))
    permissions.clear_cache()
    return data


async def _guard_role_delete(db: AsyncDatabase, doc: dict) -> None:
    if doc.get("is_system"):
        raise AppError(409, "system_role", "Role bawaan tidak bisa dihapus")
    if await db["users"].count_documents({"role_id": doc["_id"]}):
        raise AppError(409, "role_in_use", "Role masih dipakai pengguna")


async def _validate_quest(db: AsyncDatabase, data: dict, existing: dict | None) -> dict:
    if not data.get("recurring"):
        if (
            not data.get("starts_at")
            or not data.get("ends_at")
            or data["ends_at"] <= data["starts_at"]
        ):
            raise AppError(
                422, "invalid_window", "Quest tidak berulang butuh tanggal mulai & selesai"
            )
    return data


async def _no_delete(db: AsyncDatabase, doc: dict) -> None:
    raise AppError(405, "not_deletable", "Data ini tidak bisa dihapus, nonaktifkan saja")


# ---------- Registry ----------


@dataclass
class Resource:
    name: str
    collection: str
    permission: str
    schema: type[BaseModel]
    sort: list[tuple[str, int]]
    creatable: bool = True
    validate: Callable[[AsyncDatabase, dict, dict | None], Awaitable[dict]] | None = None
    after_save: Callable[[AsyncDatabase, dict], Awaitable[None]] | None = None
    before_delete: Callable[[AsyncDatabase, dict], Awaitable[None]] | None = None
    extra: dict[str, Any] = field(default_factory=dict)


async def _fn_in_use(db: AsyncDatabase, doc: dict) -> None:
    if await db["users"].count_documents({"function_id": doc["_id"]}) or await db[
        "functions"
    ].count_documents({"parent_id": doc["_id"]}):
        raise AppError(
            409, "in_use", "Fungsi masih punya anggota atau sub-fungsi — nonaktifkan saja"
        )


async def _category_in_use(db: AsyncDatabase, doc: dict) -> None:
    if await db["books"].count_documents({"category_id": doc["_id"]}):
        raise AppError(409, "in_use", "Kategori masih dipakai buku — nonaktifkan saja")


async def _badge_in_use(db: AsyncDatabase, doc: dict) -> None:
    if await db["user_badges"].count_documents({"badge_id": doc["_id"]}):
        raise AppError(409, "in_use", "Badge sudah dimiliki pengguna — nonaktifkan saja")


async def _quest_in_use(db: AsyncDatabase, doc: dict) -> None:
    if await db["user_quests"].count_documents(
        {"quest_id": doc["_id"], "completed_at": {"$ne": None}}
    ):
        raise AppError(409, "in_use", "Quest sudah pernah diselesaikan — nonaktifkan saja")


RESOURCES: dict[str, Resource] = {
    r.name: r
    for r in [
        Resource(
            "functions",
            "functions",
            "config.functions.manage",
            FunctionIn,
            [("sort_order", 1), ("name", 1)],
            validate=_validate_function,
            after_save=_after_function,
            before_delete=_fn_in_use,
        ),
        Resource(
            "roles",
            "roles",
            "config.roles.manage",
            RoleIn,
            [("name", 1)],
            validate=_validate_role,
            before_delete=_guard_role_delete,
        ),
        Resource(
            "point-rules",
            "point_rules",
            "config.points.manage",
            PointRuleIn,
            [("code", 1)],
            creatable=False,
            before_delete=_no_delete,
        ),
        Resource(
            "badges",
            "badges",
            "config.gamification.manage",
            BadgeIn,
            [("order", 1)],
            before_delete=_badge_in_use,
        ),
        Resource(
            "quests",
            "quests",
            "config.gamification.manage",
            QuestIn,
            [("order", 1)],
            validate=_validate_quest,
            before_delete=_quest_in_use,
        ),
        Resource("levels", "levels", "config.gamification.manage", LevelIn, [("level", 1)]),
        Resource(
            "book-categories",
            "book_categories",
            "config.books.manage",
            CategoryIn,
            [("sort_order", 1)],
            before_delete=_category_in_use,
        ),
        Resource(
            "notification-templates",
            "notification_templates",
            "config.notifications.manage",
            TemplateIn,
            [("type", 1)],
            creatable=False,
            before_delete=_no_delete,
            extra={"types": list(DEFAULT_TEMPLATES)},
        ),
    ]
}


def get_resource(name: str) -> Resource:
    resource = RESOURCES.get(name)
    if resource is None:
        raise AppError(404, "unknown_resource", "Resource tidak dikenal")
    return resource


def serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        out = {k: serialize(v) for k, v in value.items() if k != "_id"}
        if "_id" in value:
            out["id"] = str(value["_id"])
        return out
    if isinstance(value, list):
        return [serialize(v) for v in value]
    return value


async def list_items(db: AsyncDatabase, resource: Resource) -> list[dict]:
    rows = await db[resource.collection].find().sort(resource.sort).to_list()
    return [serialize(r) for r in rows]


async def _save(
    db: AsyncDatabase,
    resource: Resource,
    actor: dict,
    payload: dict,
    existing: dict | None,
    meta: dict,
) -> dict:
    data = resource.schema(**payload).model_dump()
    if resource.validate:
        data = await resource.validate(db, data, existing)
    now = clock.now()
    try:
        if existing:
            await db[resource.collection].update_one(
                {"_id": existing["_id"]}, {"$set": {**data, "updated_at": now}}
            )
            doc = await db[resource.collection].find_one({"_id": existing["_id"]})
            action = "update"
        else:
            doc = {**data, "created_at": now, "updated_at": now}
            doc["_id"] = (await db[resource.collection].insert_one(doc)).inserted_id
            action = "create"
    except DuplicateKeyError as exc:
        raise AppError(409, "duplicate", "Kode/nilai unik sudah dipakai") from exc
    if resource.after_save:
        await resource.after_save(db, doc)
    await audit_service.log(
        db,
        actor=actor,
        action=f"{resource.name}.{action}",
        entity_type=resource.collection,
        entity_id=doc["_id"],
        before=existing,
        after=doc,
        **meta,
    )
    return serialize(doc)


async def create(
    db: AsyncDatabase, resource: Resource, actor: dict, payload: dict, meta: dict
) -> dict:
    if not resource.creatable:
        raise AppError(405, "not_creatable", "Data ini tidak bisa ditambah")
    return await _save(db, resource, actor, payload, None, meta)


async def _get(db: AsyncDatabase, resource: Resource, item_id: ObjectId) -> dict:
    doc = await db[resource.collection].find_one({"_id": item_id})
    if doc is None:
        raise AppError(404, "not_found", "Data tidak ditemukan")
    return doc


async def update(
    db: AsyncDatabase, resource: Resource, actor: dict, item_id: ObjectId, payload: dict, meta: dict
) -> dict:
    existing = await _get(db, resource, item_id)
    # Field kunci yang tidak ada di form (mis. `code` aturan poin) dipertahankan.
    return await _save(db, resource, actor, payload, existing, meta)


async def delete(
    db: AsyncDatabase, resource: Resource, actor: dict, item_id: ObjectId, meta: dict
) -> None:
    existing = await _get(db, resource, item_id)
    if resource.before_delete:
        await resource.before_delete(db, existing)
    await db[resource.collection].delete_one({"_id": item_id})
    await audit_service.log(
        db,
        actor=actor,
        action=f"{resource.name}.delete",
        entity_type=resource.collection,
        entity_id=item_id,
        before=existing,
        **meta,
    )
