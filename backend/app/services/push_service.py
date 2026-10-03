"""Pengiriman Web Push (VAPID). Dipanggil scheduler setiap menit lewat `dispatch_due()`."""

import json
import logging
from collections import defaultdict
from typing import Any

import anyio
from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pywebpush import WebPushException, webpush

from app.core import clock
from app.core.config import get_settings
from app.schemas.notifications import PushSubscriptionIn
from app.services import notification_service, ui_config_service

log = logging.getLogger(__name__)
MAX_FAILURES = 5


def enabled() -> bool:
    settings = get_settings()
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def _send(subscription: dict, payload: dict[str, Any]) -> None:
    """Kirim satu push (blocking). Dipisah agar mudah di-mock di test."""
    settings = get_settings()
    webpush(
        subscription_info={"endpoint": subscription["endpoint"], "keys": subscription["keys"]},
        data=json.dumps(payload),
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": settings.vapid_subject},
        ttl=24 * 3600,
    )


async def subscribe(
    db: AsyncDatabase, user: dict, data: PushSubscriptionIn, user_agent: str
) -> None:
    now = clock.now()
    await db["push_subscriptions"].update_one(
        {"endpoint": data.endpoint},
        {
            "$set": {
                "user_id": user["_id"],
                "keys": data.keys.model_dump(),
                "user_agent": user_agent[:256],
                "failure_count": 0,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now, "last_success_at": None},
        },
        upsert=True,
    )


async def unsubscribe(db: AsyncDatabase, user: dict, endpoint: str) -> None:
    await db["push_subscriptions"].delete_one({"endpoint": endpoint, "user_id": user["_id"]})


async def send_to_user(db: AsyncDatabase, user_id: ObjectId, payload: dict[str, Any]) -> int:
    """Kirim ke semua perangkat user; mengembalikan jumlah yang berhasil."""
    if not enabled():
        return 0
    delivered = 0
    async for sub in db["push_subscriptions"].find({"user_id": user_id}):
        try:
            await anyio.to_thread.run_sync(_send, sub, payload)
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                # Langganan kedaluwarsa/dicabut browser → hapus.
                await db["push_subscriptions"].delete_one({"_id": sub["_id"]})
            else:
                log.warning("Push gagal (%s) ke %s", status, sub["_id"])
                result = await db["push_subscriptions"].find_one_and_update(
                    {"_id": sub["_id"]}, {"$inc": {"failure_count": 1}}
                )
                if result and result.get("failure_count", 0) + 1 >= MAX_FAILURES:
                    await db["push_subscriptions"].delete_one({"_id": sub["_id"]})
            continue
        delivered += 1
        await db["push_subscriptions"].update_one(
            {"_id": sub["_id"]}, {"$set": {"last_success_at": clock.now(), "failure_count": 0}}
        )
    return delivered


def _payload(doc: dict) -> dict[str, Any]:
    return {
        "title": doc["title"],
        "body": doc["body"],
        "url": (doc.get("data") or {}).get("url") or "/notifications",
        "tag": doc.get("group_key") or doc["type"],
        "id": str(doc["_id"]),
    }


async def dispatch_due(db: AsyncDatabase, limit: int = 500) -> dict[str, int]:
    """Kirim push untuk notifikasi yang `deliver_after`-nya sudah lewat."""
    now = clock.now()
    due = (
        await db["notifications"]
        .find({"push_status": "pending", "deliver_after": {"$lte": now}})
        .sort("deliver_after", 1)
        .limit(limit)
        .to_list()
    )
    by_user: dict[ObjectId, list[dict]] = defaultdict(list)
    for doc in due:
        by_user[doc["user_id"]].append(doc)

    stats = {"sent": 0, "skipped": 0, "deferred": 0}
    for user_id, docs in by_user.items():
        user = await db["users"].find_one({"_id": user_id}, {"timezone": 1})
        prefs = await notification_service.get_preferences(db, user_id)
        timezone = (user or {}).get("timezone", "Asia/Jakarta")
        # Preferensi bisa berubah setelah notifikasi dibuat → cek ulang jam tenang.
        later = notification_service.deliver_after(now, prefs, timezone)
        if prefs.frequency == "realtime" and later > now:
            await db["notifications"].update_many(
                {"_id": {"$in": [d["_id"] for d in docs]}}, {"$set": {"deliver_after": later}}
            )
            stats["deferred"] += len(docs)
            continue

        has_subscription = enabled() and await db["push_subscriptions"].count_documents(
            {"user_id": user_id}
        )
        if not has_subscription:
            status = "skipped"
        elif prefs.frequency == "realtime" or len(docs) == 1:
            ok = 0
            for doc in docs:
                ok += await send_to_user(db, user_id, _payload(doc)) > 0
            status = "sent" if ok else "failed"
        else:
            summary = {
                "title": (await ui_config_service.branding(db))["app_name"],
                "body": f"{len(docs)} notifikasi baru · {docs[-1]['title']}",
                "url": "/notifications",
                "tag": "digest",
            }
            status = "sent" if await send_to_user(db, user_id, summary) else "failed"
        await db["notifications"].update_many(
            {"_id": {"$in": [d["_id"] for d in docs]}},
            {"$set": {"push_status": status, "pushed_at": now}},
        )
        stats["sent" if status == "sent" else "skipped"] += len(docs)
    return stats
