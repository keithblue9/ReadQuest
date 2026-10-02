from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core import db
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.repositories.indexes import ensure_indexes


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await db.connect()
    await ensure_indexes(db.get_db())
    yield
    await db.disconnect()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="ReadQuest API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.app_env == "production" else "/docs",
        redoc_url=None,
    )
    # Frontend memakai proxy Next.js (same-origin); CORS hanya untuk akses langsung saat dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_error_handlers(app)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Data tidak valid",
                    "fields": [
                        {"loc": list(e["loc"][1:]), "message": e["msg"]} for e in exc.errors()
                    ],
                }
            },
        )

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        await db.get_db().command("ping")
        return {"status": "ok"}

    app.include_router(api_router)
    return app


app = create_app()
