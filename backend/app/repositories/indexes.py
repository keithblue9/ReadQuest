"""Definisi index semua koleksi, sesuai docs/DATABASE.md."""

from pymongo import ASCENDING as ASC
from pymongo import DESCENDING as DESC
from pymongo import IndexModel
from pymongo.asynchronous.database import AsyncDatabase

TRUE_ONLY = {"$eq": True}

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("email", ASC)], unique=True),
        IndexModel(
            [("sso.provider", ASC), ("sso.subject", ASC)],
            unique=True,
            partialFilterExpression={"sso.subject": {"$type": "string"}},
        ),
        IndexModel([("function_id", ASC), ("status", ASC)]),
        IndexModel([("role_id", ASC)]),
    ],
    "refresh_tokens": [
        IndexModel([("token_hash", ASC)], unique=True),
        IndexModel([("user_id", ASC)]),
        IndexModel([("family_id", ASC)]),
        IndexModel([("expires_at", ASC)], expireAfterSeconds=0),
    ],
    "invite_codes": [IndexModel([("code", ASC)], unique=True)],
    "functions": [
        IndexModel([("code", ASC)], unique=True),
        IndexModel([("parent_id", ASC), ("sort_order", ASC)]),
        IndexModel([("ancestors", ASC)]),
    ],
    "roles": [IndexModel([("code", ASC)], unique=True)],
    "permissions": [
        IndexModel([("code", ASC)], unique=True),
        IndexModel([("group", ASC)]),
    ],
    "books": [
        IndexModel([("normalized_key", ASC)], unique=True),
        IndexModel([("title", "text"), ("authors", "text")]),
        IndexModel([("category_id", ASC), ("stats.posts_count", DESC)]),
    ],
    "book_categories": [IndexModel([("code", ASC)], unique=True)],
    "reading_sessions": [
        IndexModel(
            [("user_id", ASC), ("local_date", ASC)],
            unique=True,
            partialFilterExpression={"is_full_points": TRUE_ONLY},
            name="one_full_points_session_per_day",
        ),
        IndexModel([("user_id", ASC), ("started_at", DESC)]),
        IndexModel([("status", ASC), ("last_heartbeat_at", ASC)]),
        IndexModel([("local_date", ASC)]),
    ],
    "streaks": [
        IndexModel([("user_id", ASC)], unique=True),
        IndexModel([("current", DESC)]),
    ],
    "posts": [
        IndexModel([("created_at", DESC)]),
        IndexModel([("author.function_id", ASC), ("created_at", DESC)]),
        IndexModel([("book_id", ASC), ("created_at", DESC)]),
        IndexModel([("topics", ASC), ("created_at", DESC)]),
        IndexModel([("author_id", ASC), ("created_at", DESC)]),
        IndexModel(
            [("author_id", ASC), ("book_id", ASC)],
            unique=True,
            partialFilterExpression={"is_book_finished": TRUE_ONLY},
            name="book_finished_once_per_user",
        ),
        IndexModel([("moderation.status", ASC), ("created_at", DESC)]),
        IndexModel([("author_id", ASC), ("content_hash", ASC)]),
    ],
    "reactions": [
        IndexModel([("post_id", ASC), ("user_id", ASC)], unique=True),
        IndexModel([("user_id", ASC), ("created_at", DESC)]),
        IndexModel([("post_author_id", ASC), ("created_at", DESC)]),
    ],
    "comments": [
        IndexModel([("post_id", ASC), ("created_at", ASC)]),
        IndexModel([("root_id", ASC), ("created_at", ASC)]),
        IndexModel([("author_id", ASC), ("created_at", DESC)]),
    ],
    "bookmarks": [
        IndexModel([("user_id", ASC), ("post_id", ASC)], unique=True),
        IndexModel([("user_id", ASC), ("created_at", DESC)]),
    ],
    "points_ledger": [
        IndexModel(
            [("user_id", ASC), ("rule_code", ASC), ("source_type", ASC), ("source_id", ASC)],
            unique=True,
            name="ledger_idempotency",
        ),
        IndexModel([("user_id", ASC), ("local_date", ASC), ("rule_code", ASC)]),
        IndexModel([("user_id", ASC), ("created_at", DESC)]),
        IndexModel([("created_at", DESC), ("function_id", ASC)]),
        IndexModel([("rule_code", ASC), ("created_at", DESC)]),
    ],
    "point_rules": [IndexModel([("code", ASC)], unique=True)],
    "levels": [
        IndexModel([("level", ASC)], unique=True),
        IndexModel([("min_points", ASC)]),
    ],
    "badges": [IndexModel([("code", ASC)], unique=True)],
    "user_badges": [IndexModel([("user_id", ASC), ("badge_id", ASC)], unique=True)],
    "quests": [
        IndexModel([("code", ASC)], unique=True),
        IndexModel([("is_active", ASC), ("starts_at", ASC), ("ends_at", ASC)]),
    ],
    "user_quests": [
        IndexModel([("user_id", ASC), ("quest_id", ASC)], unique=True),
        IndexModel([("quest_id", ASC), ("completed_at", ASC)]),
    ],
    "leaderboard_snapshots": [
        IndexModel([("category", ASC), ("period", ASC), ("period_key", ASC)], unique=True),
    ],
    "authenticity_snapshots": [
        IndexModel([("user_id", ASC), ("local_date", DESC)], unique=True),
        IndexModel([("function_id", ASC), ("local_date", DESC), ("status", ASC)]),
        IndexModel([("status", ASC), ("local_date", DESC)]),
    ],
    "notifications": [
        IndexModel([("user_id", ASC), ("read_at", ASC), ("created_at", DESC)]),
        IndexModel([("user_id", ASC), ("group_key", ASC), ("read_at", ASC)]),
        IndexModel([("push_status", ASC), ("created_at", ASC)]),
        IndexModel([("created_at", ASC)], expireAfterSeconds=90 * 24 * 3600),
    ],
    "notification_preferences": [IndexModel([("user_id", ASC)], unique=True)],
    "push_subscriptions": [
        IndexModel([("endpoint", ASC)], unique=True),
        IndexModel([("user_id", ASC)]),
    ],
    "audit_logs": [
        IndexModel([("entity_type", ASC), ("entity_id", ASC), ("created_at", DESC)]),
        IndexModel([("actor_id", ASC), ("created_at", DESC)]),
        IndexModel([("created_at", DESC)]),
    ],
    "app_settings": [IndexModel([("key", ASC)], unique=True)],
}


async def ensure_indexes(db: AsyncDatabase) -> None:
    existing = set(await db.list_collection_names())
    for name, models in INDEXES.items():
        if name not in existing:
            # Buat eksplisit agar transaksi tidak perlu membuat koleksi.
            await db.create_collection(name)
        await db[name].create_indexes(models)
