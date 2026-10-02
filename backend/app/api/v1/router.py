from fastapi import APIRouter

from app.api.v1 import auth, books, me, sessions, uploads

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(books.router)
api_router.include_router(sessions.router)
api_router.include_router(uploads.router)
