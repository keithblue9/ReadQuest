"""Data master yang dibaca saat onboarding: roles, functions, book_categories, app_settings."""

from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase


async def get_role(db: AsyncDatabase, role_id: ObjectId) -> dict | None:
    return await db["roles"].find_one({"_id": role_id})


async def get_role_by_code(db: AsyncDatabase, code: str) -> dict | None:
    return await db["roles"].find_one({"code": code})


async def list_active_functions(db: AsyncDatabase) -> list[dict]:
    cursor = db["functions"].find({"is_active": True}).sort([("sort_order", 1), ("name", 1)])
    return await cursor.to_list()


async def get_active_function(db: AsyncDatabase, function_id: ObjectId) -> dict | None:
    return await db["functions"].find_one({"_id": function_id, "is_active": True})


async def list_active_categories(db: AsyncDatabase) -> list[dict]:
    cursor = db["book_categories"].find({"is_active": True}).sort([("sort_order", 1)])
    return await cursor.to_list()


async def count_active_categories(db: AsyncDatabase, ids: list[ObjectId]) -> int:
    return await db["book_categories"].count_documents({"_id": {"$in": ids}, "is_active": True})


async def get_setting(db: AsyncDatabase, key: str, default: Any = None) -> Any:
    doc = await db["app_settings"].find_one({"key": key})
    return doc["value"] if doc else default


async def categories_by_id(db: AsyncDatabase) -> dict[ObjectId, dict]:
    return {c["_id"]: c async for c in db["book_categories"].find()}


async def get_category(db: AsyncDatabase, category_id: ObjectId) -> dict | None:
    return await db["book_categories"].find_one({"_id": category_id})
