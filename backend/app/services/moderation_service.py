"""Moderasi: laporan dari anggota, sembunyikan/pulihkan posting & komentar, pembatalan poin."""

from typing import Literal

from bson import ObjectId
from pydantic import BaseModel, Field
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.repositories import leaderboard_cache
from app.services import audit_service, points_service, post_service


class ReportIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class ModerationActionIn(BaseModel):
    action: Literal["hide", "restore", "dismiss"]
    reason: str = Field(default="", max_length=300)
    reverse_points: bool = False


async def report_post(db: AsyncDatabase, user: dict, post_id: ObjectId, data: ReportIn) -> None:
    post = await db["posts"].find_one({"_id": post_id, "deleted_at": None})
    if post is None or post["moderation"]["status"] == "hidden":
        raise AppError(404, "post_not_found", "Posting tidak ditemukan")
    if post["author_id"] == user["_id"]:
        raise AppError(422, "own_post", "Tidak bisa melaporkan posting sendiri")
    if any(r["user_id"] == user["_id"] for r in post.get("reports", [])):
        raise AppError(409, "already_reported", "Kamu sudah melaporkan posting ini")
    await db["posts"].update_one(
        {"_id": post_id},
        {
            "$push": {
                "reports": {"user_id": user["_id"], "reason": data.reason, "at": clock.now()}
            },
            "$set": {"moderation.status": "flagged"},
        },
    )


async def report_comment(
    db: AsyncDatabase, user: dict, post_id: ObjectId, comment_id: ObjectId, data: ReportIn
) -> None:
    comment = await db["comments"].find_one(
        {"_id": comment_id, "post_id": post_id, "deleted_at": None}
    )
    if comment is None or comment["moderation"]["status"] == "hidden":
        raise AppError(404, "comment_not_found", "Komentar tidak ditemukan")
    if comment["author_id"] == user["_id"]:
        raise AppError(422, "own_comment", "Tidak bisa melaporkan komentar sendiri")
    if any(r["user_id"] == user["_id"] for r in comment.get("reports", [])):
        raise AppError(409, "already_reported", "Kamu sudah melaporkan komentar ini")
    await db["comments"].update_one(
        {"_id": comment_id},
        {
            "$push": {
                "reports": {"user_id": user["_id"], "reason": data.reason, "at": clock.now()}
            },
            "$set": {"moderation.status": "flagged", "updated_at": clock.now()},
        },
    )


async def queue(db: AsyncDatabase, status: str) -> dict:
    posts = (
        await db["posts"]
        .find({"moderation.status": status})
        .sort("updated_at", -1)
        .limit(100)
        .to_list()
    )
    comments = (
        await db["comments"]
        .find({"moderation.status": status})
        .sort("updated_at", -1)
        .limit(100)
        .to_list()
    )
    post_items = await post_service.enrich(db, posts, None)
    return {
        "posts": [
            {
                **p.model_dump(mode="json"),
                "reports": [{"reason": r["reason"], "at": r["at"]} for r in raw.get("reports", [])],
                "moderation": {k: v for k, v in raw["moderation"].items() if k != "by"},
            }
            for p, raw in zip(post_items, posts, strict=True)
        ],
        "comments": [
            {
                "id": str(c["_id"]),
                "post_id": str(c["post_id"]),
                "author": c["author"]["name"],
                "content": c["content"],
                "reports": [{"reason": r["reason"], "at": r["at"]} for r in c.get("reports", [])],
                "moderation": {k: v for k, v in c["moderation"].items() if k != "by"},
                "created_at": c["created_at"],
            }
            for c in comments
        ],
    }


async def _reverse_points(
    db: AsyncDatabase, actor: dict, source_ids: list[ObjectId], note: str
) -> int:
    reversed_count = 0
    async for entry in db["points_ledger"].find(
        {"source_id": {"$in": source_ids}, "reverses_id": None, "points": {"$gt": 0}}
    ):
        already = await db["points_ledger"].find_one({"reverses_id": entry["_id"]})
        if already:
            continue
        user = await db["users"].find_one({"_id": entry["user_id"]})
        if user:
            await points_service.adjust(
                db,
                user=user,
                points=-entry["points"],
                note=note,
                actor_id=actor["_id"],
                reverses_id=entry["_id"],
            )
            reversed_count += 1
    return reversed_count


async def moderate(
    db: AsyncDatabase,
    actor: dict,
    kind: str,
    item_id: ObjectId,
    data: ModerationActionIn,
    meta: dict,
) -> dict:
    collection = {"posts": "posts", "comments": "comments"}.get(kind)
    if collection is None:
        raise AppError(404, "unknown_kind", "Jenis konten tidak dikenal")
    doc = await db[collection].find_one({"_id": item_id})
    if doc is None:
        raise AppError(404, "not_found", "Konten tidak ditemukan")
    status = {"hide": "hidden", "restore": "visible", "dismiss": "visible"}[data.action]
    now = clock.now()
    update: dict = {
        "moderation": {
            "status": status,
            "by": actor["_id"],
            "reason": data.reason or None,
            "at": now,
        },
        "updated_at": now,
    }
    if data.action == "dismiss":
        update["reports"] = []
    await db[collection].update_one({"_id": item_id}, {"$set": update})
    if collection == "comments" and doc["moderation"]["status"] != status:
        delta = -1 if status == "hidden" else 1
        await db["posts"].update_one({"_id": doc["post_id"]}, {"$inc": {"counts.comments": delta}})

    reversed_count = 0
    if data.action == "hide" and data.reverse_points:
        sources = [item_id]
        if collection == "posts" and doc.get("session_id"):
            sources.append(doc["session_id"])
        reversed_count = await _reverse_points(
            db, actor, sources, f"Moderasi: {data.reason or 'konten disembunyikan'}"
        )
    await leaderboard_cache.invalidate_open(db)
    await audit_service.log(
        db,
        actor=actor,
        action=f"moderation.{kind}.{data.action}",
        entity_type=collection,
        entity_id=item_id,
        before={"moderation": doc.get("moderation")},
        after={"moderation": update["moderation"], "reversed_points": reversed_count},
        **meta,
    )
    return {"status": status, "reversed_entries": reversed_count}
