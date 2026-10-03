from datetime import UTC, datetime

from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.core.errors import AppError
from app.repositories import catalog, users
from app.schemas.user import MeOut, MeUpdateIn, OnboardingIn, RoleOut, UserStatsOut
from app.services import permissions, points_service, streak_service, target_service

DEFAULT_DAILY_TARGET = 15


async def build_me(db: AsyncDatabase, user: dict) -> MeOut:
    role = await permissions.get_role(db, user["role_id"])
    stats = dict(user.get("stats") or {})
    today = clock.local_date(clock.now(), user.get("timezone", "Asia/Jakarta"))
    stats["current_streak"] = streak_service.effective_current(
        await streak_service.get(db, user["_id"]), today, await streak_service.allowance(db)
    )
    level, upcoming = await points_service.level_for(db, int(stats.get("points_total", 0)))
    return MeOut(
        id=user["_id"],
        phone=user.get("phone"),
        email=user.get("email"),
        name=user["name"],
        avatar_url=user.get("avatar_url"),
        role=RoleOut(code=role["code"], name=role["name"]) if role else RoleOut(code="", name=""),
        permissions=sorted(role.get("permission_codes", [])) if role else [],
        function_id=user.get("function_id"),
        interests=user.get("interests", []),
        daily_target_minutes=user.get("daily_target_minutes", DEFAULT_DAILY_TARGET),
        target_mode=user.get("target_mode", "daily"),
        weekly_target_minutes=await target_service.weekly_target(db, user),
        headline=user.get("headline", ""),
        favorite_book_ids=user.get("favorite_book_ids", []),
        timezone=user.get("timezone", "Asia/Jakarta"),
        onboarding_completed=user.get("onboarding_completed_at") is not None,
        stats=UserStatsOut(**{k: v for k, v in stats.items() if k in UserStatsOut.model_fields}),
        level=points_service.level_out(level, upcoming),
    )


async def update_me(db: AsyncDatabase, user: dict, data: MeUpdateIn) -> dict:
    fields = data.model_dump(exclude_none=True)
    if not fields:
        return user
    if "daily_target_minutes" in fields:
        min_minutes, _ = await daily_target_bounds(db)
        if fields["daily_target_minutes"] < min_minutes:
            raise AppError(
                422, "invalid_daily_target", f"Target harian minimal {min_minutes} menit"
            )
    if "headline" in fields:
        fields["headline"] = fields["headline"].strip()
    if "favorite_book_ids" in fields:
        ids = list(dict.fromkeys(fields["favorite_book_ids"]))
        if await db["books"].count_documents({"_id": {"$in": ids}}) != len(ids):
            raise AppError(422, "invalid_book", "Ada buku favorit yang tidak ditemukan")
        fields["favorite_book_ids"] = ids
    return await users.update(db, user["_id"], fields)


async def daily_target_bounds(db: AsyncDatabase) -> tuple[int, int]:
    min_minutes = await catalog.get_setting(db, "session.min_minutes", 15)
    default = await catalog.get_setting(
        db, "onboarding.default_daily_target_minutes", DEFAULT_DAILY_TARGET
    )
    return int(min_minutes), int(default)


async def complete_onboarding(db: AsyncDatabase, user: dict, data: OnboardingIn) -> dict:
    if await catalog.get_active_function(db, data.function_id) is None:
        raise AppError(422, "invalid_function", "Fungsi/bagian tidak ditemukan")

    interests = list(dict.fromkeys(data.interests))
    if await catalog.count_active_categories(db, interests) != len(interests):
        raise AppError(422, "invalid_interests", "Ada minat baca yang tidak valid")

    min_minutes, _ = await daily_target_bounds(db)
    if data.daily_target_minutes < min_minutes:
        raise AppError(422, "invalid_daily_target", f"Target harian minimal {min_minutes} menit")

    fields = {
        "function_id": data.function_id,
        "interests": interests,
        "daily_target_minutes": data.daily_target_minutes,
        "timezone": data.timezone,
    }
    if user.get("onboarding_completed_at") is None:
        fields["onboarding_completed_at"] = datetime.now(UTC)
    return await users.update(db, user["_id"], fields)
