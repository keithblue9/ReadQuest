import os
import uuid

# Konfigurasi test di-set sebelum modul app diimpor (Settings di-cache).
os.environ.update(
    {
        "APP_ENV": "test",
        "JWT_SECRET": "test-secret-" + "x" * 32,
        "MONGODB_DB": f"readquest_test_{uuid.uuid4().hex[:8]}",
        "ADMIN_EMAIL": "admin@example.com",
        "ADMIN_PASSWORD": "admin-pass-123",
        "SEED_INVITE_CODE": "TESTCODE",
        "RATE_LIMIT_ENABLED": "true",
    }
)

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi import Depends  # noqa: E402

from app.api.deps import require_permission  # noqa: E402
from app.core import db as db_module  # noqa: E402
from app.core.rate_limit import rate_limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.seed.__main__ import seed  # noqa: E402
from app.services import permissions  # noqa: E402


@app.get("/test/admin-only", dependencies=[Depends(require_permission("admin.dashboard.view"))])
async def _admin_only() -> dict[str, bool]:
    return {"ok": True}


@pytest.fixture(scope="session", autouse=True)
async def database():
    await db_module.connect()
    db = db_module.get_db()
    await seed(db)
    yield db
    await db_module.get_client().drop_database(db.name)
    await db_module.disconnect()


@pytest.fixture(autouse=True)
def _reset_state():
    rate_limiter.reset()
    permissions.clear_cache()


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:10]}@example.com"


async def register(client: httpx.AsyncClient, **overrides) -> httpx.Response:
    payload = {
        "email": unique_email(),
        "password": "rahasia-123",
        "name": "Pembaca Uji",
        "invite_code": "TESTCODE",
        **overrides,
    }
    return await client.post("/api/v1/auth/register", json=payload)


def auth_header(response: httpx.Response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
