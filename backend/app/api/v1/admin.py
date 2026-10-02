import re
from datetime import UTC, datetime
from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Query, Request, Response, status
from pydantic import ValidationError

from app.api.deps import CurrentUser, Db, require_permission
from app.core.errors import AppError, forbidden
from app.repositories import books, catalog
from app.schemas.books import BookCreateIn
from app.schemas.common import PyObjectId
from app.services import (
    admin_dashboard_service,
    admin_resources,
    admin_users_service,
    audit_service,
    book_service,
    export_service,
    moderation_service,
    permissions,
    settings_service,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def meta(request: Request) -> dict[str, str]:
    return {
        "ip": request.client.host if request.client else "",
        "user_agent": request.headers.get("user-agent", ""),
    }


Meta = Annotated[dict, Depends(meta)]


def need(code: str):
    return Annotated[dict, Depends(require_permission(code))]


# ---------- Dashboard & export ----------


@router.get("/dashboard")
async def dashboard(
    db: Db, _: need("admin.dashboard.view"), days: Annotated[int, Query(ge=7, le=365)] = 30
) -> dict:
    return await admin_dashboard_service.build(db, days)


@router.get("/export.{fmt}")
async def export(
    fmt: str,
    db: Db,
    actor: need("admin.export"),
    request: Request,
    days: Annotated[int, Query(ge=7, le=365)] = 30,
) -> Response:
    if fmt not in {"xlsx", "pdf"}:
        raise AppError(404, "unknown_format", "Format harus xlsx atau pdf")
    data = await admin_dashboard_service.build(db, days)
    users = await admin_dashboard_service.user_rows(db, days)
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    if fmt == "xlsx":
        content = export_service.to_xlsx(data, users)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = export_service.to_pdf(data, users)
        media = "application/pdf"
    await audit_service.log(
        db,
        actor=actor,
        action=f"export.{fmt}",
        entity_type="report",
        entity_id=None,
        after={"days": days},
        **meta(request),
    )
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="readquest-laporan-{stamp}.{fmt}"'},
    )


# ---------- Resource generik ----------


async def _resource_actor(db, user: dict, name: str) -> admin_resources.Resource:
    resource = admin_resources.get_resource(name)
    role = await permissions.get_role(db, user["role_id"])
    if not role or resource.permission not in role.get("permission_codes", []):
        raise forbidden()
    return resource


@router.get("/resources/{name}")
async def list_resource(name: str, db: Db, user: CurrentUser) -> dict[str, Any]:
    resource = await _resource_actor(db, user, name)
    return {
        "items": await admin_resources.list_items(db, resource),
        "creatable": resource.creatable,
        **resource.extra,
    }


@router.post("/resources/{name}", status_code=status.HTTP_201_CREATED)
async def create_resource(
    name: str, db: Db, user: CurrentUser, m: Meta, payload: Annotated[dict, Body()]
) -> dict:
    resource = await _resource_actor(db, user, name)
    return await _wrap(admin_resources.create(db, resource, user, payload, m))


@router.put("/resources/{name}/{item_id}")
async def update_resource(
    name: str,
    item_id: PyObjectId,
    db: Db,
    user: CurrentUser,
    m: Meta,
    payload: Annotated[dict, Body()],
) -> dict:
    resource = await _resource_actor(db, user, name)
    return await _wrap(admin_resources.update(db, resource, user, item_id, payload, m))


@router.delete("/resources/{name}/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    name: str, item_id: PyObjectId, db: Db, user: CurrentUser, m: Meta
) -> Response:
    resource = await _resource_actor(db, user, name)
    await admin_resources.delete(db, resource, user, item_id, m)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _wrap(coro):
    """Ubah ValidationError Pydantic dari payload generik menjadi 422 yang konsisten."""
    try:
        return await coro
    except ValidationError as exc:
        raise AppError(
            422,
            "validation_error",
            "Data tidak valid",
            {"fields": [{"loc": list(e["loc"]), "message": e["msg"]} for e in exc.errors()]},
        ) from exc


# Permission yang membuka setidaknya satu halaman Admin.
ADMIN_AREA_PERMISSIONS = {
    "admin.dashboard.view",
    "admin.export",
    "users.manage",
    "post.moderate",
    "audit.view",
    "invites.manage",
    "config.functions.manage",
    "config.roles.manage",
    "config.points.manage",
    "config.gamification.manage",
    "config.books.manage",
    "config.notifications.manage",
    "config.settings.manage",
}


@router.get("/lookups")
async def lookups(db: Db, user: CurrentUser) -> dict:
    """Daftar ringkas role, fungsi, kategori, dan pengguna untuk pilihan di form Admin."""
    role = await permissions.get_role(db, user["role_id"])
    if not ADMIN_AREA_PERMISSIONS & set((role or {}).get("permission_codes", [])):
        raise forbidden()
    roles = await db["roles"].find({}, {"code": 1, "name": 1}).sort("name", 1).to_list()
    functions = (
        await db["functions"]
        .find({}, {"name": 1, "code": 1, "parent_id": 1, "ancestors": 1, "is_active": 1})
        .sort([("sort_order", 1), ("name", 1)])
        .to_list()
    )
    categories = (
        await db["book_categories"]
        .find({}, {"code": 1, "name": 1, "icon": 1})
        .sort("sort_order", 1)
        .to_list()
    )
    users = (
        await db["users"]
        .find({"status": "active"}, {"name": 1, "email": 1})
        .sort("name", 1)
        .limit(1000)
        .to_list()
    )
    return admin_resources.serialize(
        {"roles": roles, "functions": functions, "categories": categories, "users": users}
    )


@router.get("/permissions")
async def permission_catalog(db: Db, _: need("config.roles.manage")) -> list[dict]:
    rows = await db["permissions"].find().sort([("group", 1), ("code", 1)]).to_list()
    return [
        {"code": p["code"], "group": p["group"], "description": p.get("description", "")}
        for p in rows
    ]


# ---------- Pengaturan ----------


@router.get("/settings")
async def get_settings_list(db: Db, _: need("config.settings.manage")) -> list[dict]:
    return await settings_service.list_settings(db)


@router.put("/settings/{key}")
async def put_setting(
    key: str,
    db: Db,
    actor: need("config.settings.manage"),
    m: Meta,
    value: Annotated[Any, Body(embed=True)],
) -> dict:
    if key == "notifications.schedule":
        role = await permissions.get_role(db, actor["role_id"])
        if "config.notifications.manage" not in (role or {}).get("permission_codes", []):
            raise forbidden()
    return await settings_service.update_setting(db, actor, key, value, m)


# ---------- Pengguna ----------


@router.get("/users")
async def list_users(
    db: Db,
    _: need("users.manage"),
    q: Annotated[str | None, Query(max_length=60)] = None,
    role_id: PyObjectId | None = None,
    function_id: PyObjectId | None = None,
    status_: Annotated[str | None, Query(alias="status")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    return await admin_users_service.list_users(
        db, q=q, role_id=role_id, function_id=function_id, status=status_, skip=offset, limit=limit
    )


@router.put("/users/{user_id}")
async def update_user(
    user_id: PyObjectId,
    data: admin_users_service.AdminUserUpdateIn,
    db: Db,
    actor: need("users.manage"),
    m: Meta,
) -> dict:
    result = await admin_users_service.update_user(db, actor, user_id, data, m)
    permissions.clear_cache()
    return result


# ---------- Katalog buku ----------


@router.put("/books/{book_id}")
async def update_book(
    book_id: PyObjectId, data: BookCreateIn, db: Db, actor: need("config.books.manage"), m: Meta
) -> dict:
    book = await book_service.get_or_404(db, book_id)
    if await catalog.get_category(db, data.category_id) is None:
        raise AppError(422, "invalid_category", "Kategori tidak ditemukan")
    key = books.normalized_key(data.title, data.authors)
    clash = await books.find_by_key(db, key)
    if clash and clash["_id"] != book_id:
        raise AppError(409, "duplicate_book", "Buku dengan judul & pengarang ini sudah ada")
    fields = {**data.model_dump(exclude={"cover_image_key"}), "normalized_key": key}
    await books.update(db, book_id, {"$set": fields})
    # Salinan denormalisasi di posting ikut diperbarui.
    await db["posts"].update_many(
        {"book_id": book_id},
        {
            "$set": {
                "book.title": data.title,
                "book.authors": data.authors,
                "book.category_id": data.category_id,
            }
        },
    )
    await audit_service.log(
        db,
        actor=actor,
        action="book.update",
        entity_type="books",
        entity_id=book_id,
        before={k: book.get(k) for k in fields},
        after=fields,
        **m,
    )
    updated = await book_service.get_or_404(db, book_id)
    return book_service.to_out(updated, await catalog.categories_by_id(db)).model_dump(mode="json")


# ---------- Moderasi ----------


@router.get("/moderation")
async def moderation_queue(
    db: Db, _: need("post.moderate"), status_: Annotated[str, Query(alias="status")] = "flagged"
) -> dict:
    if status_ not in {"flagged", "hidden"}:
        raise AppError(422, "invalid_status", "Status harus flagged atau hidden")
    return await moderation_service.queue(db, status_)


@router.post("/moderation/{kind}/{item_id}")
async def moderate(
    kind: str,
    item_id: PyObjectId,
    data: moderation_service.ModerationActionIn,
    db: Db,
    actor: need("post.moderate"),
    m: Meta,
) -> dict:
    return await moderation_service.moderate(db, actor, kind, item_id, data, m)


# ---------- Audit log ----------


@router.get("/audit")
async def audit_log(
    db: Db,
    _: need("audit.view"),
    entity_type: Annotated[str | None, Query(max_length=40)] = None,
    action: Annotated[str | None, Query(max_length=60)] = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    query: dict = {}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = re.compile("^" + re.escape(action))
    if cursor:
        if not ObjectId.is_valid(cursor):
            raise AppError(400, "invalid_cursor", "Cursor tidak valid")
        query["_id"] = {"$lt": ObjectId(cursor)}
    rows = await db["audit_logs"].find(query).sort("_id", -1).limit(limit + 1).to_list()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        "items": [admin_resources.serialize(r) for r in rows],
        "next_cursor": str(rows[-1]["_id"]) if has_more and rows else None,
    }
