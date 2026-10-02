from fastapi import APIRouter

from app.api.v1 import (
    auth,
    books,
    gamification,
    leaderboard,
    me,
    notifications,
    posts,
    sessions,
    uploads,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(books.router)
api_router.include_router(sessions.router)
api_router.include_router(uploads.router)
api_router.include_router(posts.router)
api_router.include_router(users.router)
api_router.include_router(leaderboard.router)
api_router.include_router(gamification.router)
api_router.include_router(notifications.router)
