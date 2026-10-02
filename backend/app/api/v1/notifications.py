from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status

from app.api.deps import CurrentUser, Db
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.rate_limit import rate_limiter
from app.schemas.notifications import (
    MarkReadIn,
    NotificationPageOut,
    PreferencesIn,
    PreferencesOut,
    PushSubscriptionIn,
    PushUnsubscribeIn,
)
from app.services import notification_service, push_service

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationPageOut)
async def notifications(
    db: Db,
    user: CurrentUser,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> NotificationPageOut:
    return await notification_service.inbox(db, user["_id"], cursor, limit)


@router.get("/notifications/unread-count")
async def unread_count(db: Db, user: CurrentUser) -> dict[str, int]:
    return {"unread_count": await notification_service.unread_count(db, user["_id"])}


@router.post("/notifications/read")
async def mark_read(data: MarkReadIn, db: Db, user: CurrentUser) -> dict[str, int]:
    return {"unread_count": await notification_service.mark_read(db, user["_id"], data)}


@router.get("/me/notification-preferences", response_model=PreferencesOut)
async def get_preferences(db: Db, user: CurrentUser) -> PreferencesOut:
    return await notification_service.get_preferences(db, user["_id"])


@router.put("/me/notification-preferences", response_model=PreferencesOut)
async def save_preferences(data: PreferencesIn, db: Db, user: CurrentUser) -> PreferencesOut:
    return await notification_service.save_preferences(db, user["_id"], data)


@router.get("/push/config")
async def push_config(_: CurrentUser) -> dict[str, str | bool | None]:
    """Kunci publik VAPID untuk `pushManager.subscribe()` (bukan rahasia)."""
    settings = get_settings()
    return {"enabled": push_service.enabled(), "public_key": settings.vapid_public_key}


@router.post("/push/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    data: PushSubscriptionIn, request: Request, db: Db, user: CurrentUser
) -> Response:
    await push_service.subscribe(db, user, data, request.headers.get("user-agent", ""))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/push/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(data: PushUnsubscribeIn, db: Db, user: CurrentUser) -> Response:
    await push_service.unsubscribe(db, user, data.endpoint)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/push/test")
async def push_test(db: Db, user: CurrentUser) -> dict[str, int]:
    if not push_service.enabled():
        raise AppError(503, "push_disabled", "Push belum dikonfigurasi di server")
    rate_limiter.hit(f"push-test:{user['_id']}", limit=3, window_seconds=60)
    delivered = await push_service.send_to_user(
        db,
        user["_id"],
        {
            "title": "Tes notifikasi ReadQuest 🔔",
            "body": "Notifikasi push sudah aktif!",
            "url": "/",
        },
    )
    return {"delivered": delivered}
