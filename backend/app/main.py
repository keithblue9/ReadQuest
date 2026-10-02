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
from app.core.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.core.storage import get_storage
from app.jobs.scheduler import scheduler
from app.repositories.indexes import ensure_indexes
from app.ws import rooms


async def prepare_database(database) -> None:
    """Sinkronkan index; jalankan seed idempoten bila SEED_ON_STARTUP=true."""
    await ensure_indexes(database)
    if get_settings().seed_on_startup:
        from app.seed.__main__ import seed

        await seed(database)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await db.connect()
    await prepare_database(db.get_db())
    await get_storage().ensure_ready()
    if get_settings().scheduler_enabled:
        scheduler.start(db.get_db)
    yield
    await scheduler.stop()
    await db.disconnect()


def create_app() -> FastAPI:
    settings = get_settings()
    production = settings.app_env == "production"
    app = FastAPI(
        title="ReadQuest API",
        version="1.0.0",
        lifespan=lifespan,
        # Dokumentasi API tidak dipublikasikan di production.
        docs_url=None if production else "/docs",
        openapi_url=None if production else "/openapi.json",
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
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(SecurityHeadersMiddleware)
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
    app.include_router(rooms.router)
    return app


app = create_app()
