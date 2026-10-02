"""Interaksi sosial: reaksi, komentar berantai, mention, bookmark, posting diskusi buku."""

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.core.errors import AppError, forbidden
from app.repositories import books, catalog, leaderboard_cache, posts
from app.schemas.points import AwardOut
from app.schemas.posts import (
    BookmarkStateOut,
    CommentCreatedOut,
    CommentIn,
    CommentOut,
    DiscussionIn,
    PostCountsOut,
    PostOut,
    ReactionStateOut,
)
from app.services import badge_service, permissions, points_service, post_service, quest_service
from app.services.note_validation import content_hash, tokenize
from app.services.upload_service import owns_key

DISCUSSION_MIN_WORDS = 3


async def get_post_or_404(db: AsyncDatabase, post_id: ObjectId) -> dict:
    post = await posts.get_visible(db, post_id)
    if post is None:
        raise AppError(404, "post_not_found", "Posting tidak ditemukan")
    return post


def _local_date(user: dict) -> str:
    return clock.local_date(clock.now(), user.get("timezone", "Asia/Jakarta"))


async def validate_mentions(db: AsyncDatabase, ids: list[ObjectId]) -> list[ObjectId]:
    unique = list(dict.fromkeys(ids))
    if not unique:
        return []
    found = await db["users"].count_documents({"_id": {"$in": unique}, "status": "active"})
    if found != len(unique):
        raise AppError(422, "invalid_mention", "Ada pengguna yang di-mention tidak ditemukan")
    return unique


# ---------- Reaksi ----------


async def react(db: AsyncDatabase, user: dict, post_id: ObjectId, type_: str) -> ReactionStateOut:
    post = await get_post_or_404(db, post_id)
    now = clock.now()
    # Dokumen reaksi tidak pernah dihapus (type=None saat dibatalkan) agar poin "like
    # diterima" idempoten walau reaksi dibatalkan lalu diberikan lagi.
    before = await db["reactions"].find_one_and_update(
        {"post_id": post_id, "user_id": user["_id"]},
        {
            "$set": {"type": type_, "updated_at": now},
            "$setOnInsert": {"post_author_id": post["author_id"], "created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.BEFORE,
    )
    previous = before.get("type") if before else None
    if previous != type_:
        inc = {f"counts.{type_}": 1}
        if previous:
            inc[f"counts.{previous}"] = -1
        post = await db["posts"].find_one_and_update(
            {"_id": post_id}, {"$inc": inc}, return_document=ReturnDocument.AFTER
        )

    if previous != type_:
        await leaderboard_cache.invalidate_open(db)
    if post["author_id"] != user["_id"]:
        reaction = await db["reactions"].find_one({"post_id": post_id, "user_id": user["_id"]})
        author = await db["users"].find_one({"_id": post["author_id"]})
        if author:
            if previous is None:
                await badge_service.evaluate(db, author)
            await points_service.award(
                db,
                user=author,
                rule_code="like_received",
                source_type="reaction",
                source_id=reaction["_id"],
                local_date=_local_date(author),
                actor_id=user["_id"],
            )
    return ReactionStateOut(reaction=type_, counts=PostCountsOut(**post["counts"]))


async def unreact(db: AsyncDatabase, user: dict, post_id: ObjectId) -> ReactionStateOut:
    post = await get_post_or_404(db, post_id)
    before = await db["reactions"].find_one_and_update(
        {"post_id": post_id, "user_id": user["_id"], "type": {"$ne": None}},
        {"$set": {"type": None, "updated_at": clock.now()}},
    )
    if before:
        post = await db["posts"].find_one_and_update(
            {"_id": post_id},
            {"$inc": {f"counts.{before['type']}": -1}},
            return_document=ReturnDocument.AFTER,
        )
        await leaderboard_cache.invalidate_open(db)
    return ReactionStateOut(reaction=None, counts=PostCountsOut(**post["counts"]))


# ---------- Bookmark ----------


async def bookmark(db: AsyncDatabase, user: dict, post_id: ObjectId) -> BookmarkStateOut:
    post = await get_post_or_404(db, post_id)
    try:
        await db["bookmarks"].insert_one(
            {"user_id": user["_id"], "post_id": post_id, "created_at": clock.now()}
        )
        post = await db["posts"].find_one_and_update(
            {"_id": post_id},
            {"$inc": {"counts.bookmarks": 1}},
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        pass
    return BookmarkStateOut(bookmarked=True, bookmarks=post["counts"]["bookmarks"])


async def unbookmark(db: AsyncDatabase, user: dict, post_id: ObjectId) -> BookmarkStateOut:
    post = await get_post_or_404(db, post_id)
    result = await db["bookmarks"].delete_one({"user_id": user["_id"], "post_id": post_id})
    if result.deleted_count:
        post = await db["posts"].find_one_and_update(
            {"_id": post_id},
            {"$inc": {"counts.bookmarks": -1}},
            return_document=ReturnDocument.AFTER,
        )
    return BookmarkStateOut(bookmarked=False, bookmarks=post["counts"]["bookmarks"])


async def bookmarked_post_ids(db: AsyncDatabase, user_id: ObjectId, limit: int = 500) -> list:
    cursor = db["bookmarks"].find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    return [b["post_id"] async for b in cursor]


# ---------- Komentar ----------


def comment_out(comment: dict, users: dict[ObjectId, dict]) -> CommentOut:
    deleted = comment.get("deleted_at") is not None
    author = comment.get("author") or {}
    return CommentOut(
        id=comment["_id"],
        post_id=comment["post_id"],
        parent_id=comment.get("parent_id"),
        root_id=comment.get("root_id"),
        author={
            "id": comment["author_id"],
            "name": author.get("name", ""),
            "avatar_url": author.get("avatar_url"),
        },
        content="" if deleted else comment["content"],
        is_meaningful=comment.get("is_meaningful", False),
        deleted=deleted,
        mentions=[]
        if deleted
        else [m for m in (post_service.mini(i, users) for i in comment.get("mentions", [])) if m],
        created_at=comment["created_at"],
    )


async def list_comments(db: AsyncDatabase, post_id: ObjectId) -> list[CommentOut]:
    await get_post_or_404(db, post_id)
    rows = (
        await db["comments"]
        .find({"post_id": post_id, "moderation.status": {"$ne": "hidden"}})
        .sort("created_at", 1)
        .limit(500)
        .to_list()
    )
    users = await post_service.users_by_id(db, {m for c in rows for m in c.get("mentions", [])})
    # Komentar terhapus hanya ditampilkan bila masih punya balasan.
    has_replies = {c.get("parent_id") for c in rows if c.get("deleted_at") is None}
    return [
        comment_out(c, users)
        for c in rows
        if c.get("deleted_at") is None or c["_id"] in has_replies
    ]


async def _is_meaningful(db: AsyncDatabase, author_id: ObjectId, text: str) -> tuple[bool, str]:
    tokens = tokenize(text)
    digest = content_hash(tokens)
    min_words = int(await catalog.get_setting(db, "comment.meaningful_min_words", 8))
    min_unique = float(await catalog.get_setting(db, "note.min_unique_word_ratio", 0.4))
    if len(tokens) < min_words or len(set(tokens)) / len(tokens) < min_unique:
        return False, digest
    duplicate = await db["comments"].find_one(
        {"author_id": author_id, "content_hash": digest, "deleted_at": None}, {"_id": 1}
    )
    return duplicate is None, digest


async def create_comment(
    db: AsyncDatabase, user: dict, post_id: ObjectId, data: CommentIn
) -> CommentCreatedOut:
    post = await get_post_or_404(db, post_id)
    content = data.content.strip()
    if not content:
        raise AppError(422, "empty_comment", "Komentar tidak boleh kosong")

    parent = None
    if data.parent_id:
        parent = await db["comments"].find_one({"_id": data.parent_id, "post_id": post_id})
        if parent is None or parent.get("deleted_at") is not None:
            raise AppError(422, "invalid_parent", "Komentar yang dibalas tidak ditemukan")
    mentions = await validate_mentions(db, data.mention_ids)
    meaningful, digest = await _is_meaningful(db, user["_id"], content)

    now = clock.now()
    doc = {
        "post_id": post_id,
        "post_author_id": post["author_id"],
        "author_id": user["_id"],
        "author": {"name": user["name"], "avatar_url": user.get("avatar_url")},
        "parent_id": parent["_id"] if parent else None,
        "root_id": (parent.get("root_id") or parent["_id"]) if parent else None,
        "content": content,
        "word_count": len(tokenize(content)),
        "content_hash": digest,
        "is_meaningful": meaningful,
        "mentions": mentions,
        "moderation": {"status": "visible", "by": None, "reason": None, "at": None},
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }
    doc["_id"] = (await db["comments"].insert_one(doc)).inserted_id
    await db["posts"].update_one({"_id": post_id}, {"$inc": {"counts.comments": 1}})

    awarded: list[AwardOut] = []
    if meaningful and post["author_id"] != user["_id"]:
        given = await points_service.award(
            db,
            user=user,
            rule_code="meaningful_comment_given",
            source_type="comment",
            source_id=doc["_id"],
            local_date=_local_date(user),
        )
        if given:
            awarded.append(
                AwardOut(rule_code=given.rule_code, name=given.name, points=given.points)
            )
        author = await db["users"].find_one({"_id": post["author_id"]})
        if author:
            await points_service.award(
                db,
                user=author,
                rule_code="meaningful_comment_received",
                source_type="comment",
                source_id=doc["_id"],
                local_date=_local_date(author),
                actor_id=user["_id"],
            )
    if meaningful:
        await quest_service.evaluate(db, user)
        await badge_service.evaluate(db, user)
    users = await post_service.users_by_id(db, set(mentions))
    return CommentCreatedOut(comment=comment_out(doc, users), points=awarded)


async def delete_comment(
    db: AsyncDatabase, user: dict, post_id: ObjectId, comment_id: ObjectId
) -> None:
    comment = await db["comments"].find_one(
        {"_id": comment_id, "post_id": post_id, "deleted_at": None}
    )
    if comment is None:
        raise AppError(404, "comment_not_found", "Komentar tidak ditemukan")
    if comment["author_id"] != user["_id"]:
        role = await permissions.get_role(db, user["role_id"])
        if not role or "post.moderate" not in role.get("permission_codes", []):
            raise forbidden("Hanya penulis komentar yang dapat menghapusnya")
    now = clock.now()
    await db["comments"].update_one(
        {"_id": comment_id}, {"$set": {"deleted_at": now, "updated_at": now}}
    )
    await db["posts"].update_one({"_id": post_id}, {"$inc": {"counts.comments": -1}})


# ---------- Posting diskusi buku ----------


async def create_discussion(
    db: AsyncDatabase, user: dict, book_id: ObjectId, data: DiscussionIn
) -> PostOut:
    book = await books.get(db, book_id)
    if book is None:
        raise AppError(404, "book_not_found", "Buku tidak ditemukan")
    tokens = tokenize(data.content)
    if len(tokens) < DISCUSSION_MIN_WORDS:
        raise AppError(422, "discussion_too_short", f"Tulis minimal {DISCUSSION_MIN_WORDS} kata")
    if any(not owns_key(user["_id"], k) for k in data.image_keys):
        raise AppError(422, "invalid_image", "Foto tidak valid, unggah ulang fotonya")
    mentions = await validate_mentions(db, data.mention_ids)
    digest = content_hash(tokens)
    if await posts.exists_with_hash(db, user["_id"], digest):
        raise AppError(422, "duplicate_post", "Kamu sudah pernah mengirim tulisan yang sama")

    category = await catalog.get_category(db, book["category_id"])
    now = clock.now()
    post = {
        "author_id": user["_id"],
        "author": {
            "name": user["name"],
            "avatar_url": user.get("avatar_url"),
            "function_id": user.get("function_id"),
        },
        "session_id": None,
        "book_id": book["_id"],
        "book": {
            "title": book["title"],
            "authors": book["authors"],
            "category_id": book["category_id"],
        },
        "type": "discussion",
        "content": data.content.strip(),
        "word_count": len(tokens),
        "content_hash": digest,
        "image_keys": data.image_keys,
        "rating": None,
        "page_progress": None,
        "is_book_finished": False,
        "topics": [category["code"]] if category else [],
        "mentions": mentions,
        "counts": {"like": 0, "insightful": 0, "inspiring": 0, "comments": 0, "bookmarks": 0},
        "visibility": "team",
        "moderation": {"status": "visible", "by": None, "reason": None, "at": None},
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }
    post["_id"] = await posts.insert(db, post)
    await books.update(db, book_id, {"$inc": {"stats.posts_count": 1}})
    return (await post_service.enrich(db, [post], user["_id"]))[0]
