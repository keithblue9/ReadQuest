import os
import tempfile
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
        "STORAGE_BACKEND": "local",
        "LOCAL_STORAGE_DIR": tempfile.mkdtemp(prefix="readquest-test-storage-"),
    }
)

import io  # noqa: E402
from datetime import UTC, datetime, timedelta  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi import Depends  # noqa: E402
from PIL import Image  # noqa: E402

from app.api.deps import require_permission  # noqa: E402
from app.core import clock  # noqa: E402
from app.core import db as db_module  # noqa: E402
from app.core.rate_limit import rate_limiter  # noqa: E402
from app.core.storage import get_storage  # noqa: E402
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
    await get_storage().ensure_ready()
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


class FakeClock:
    def __init__(self) -> None:
        # 09:00 WIB
        self.current = datetime(2026, 10, 5, 2, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current

    def advance(self, **kwargs: float) -> None:
        self.current += timedelta(**kwargs)


@pytest.fixture
def fake_clock(monkeypatch) -> FakeClock:
    fc = FakeClock()
    monkeypatch.setattr(clock, "now", fc.now)
    return fc


def jpeg_bytes(size: tuple[int, int] = (400, 300), exif: bool = False) -> bytes:
    img = Image.new("RGB", size, (108, 77, 246))
    out = io.BytesIO()
    if exif:
        data = Image.Exif()
        data[0x010F] = "SecretPhoneMaker"  # Make
        data[0x8825] = {2: (6.0, 10.0, 0.0)}  # GPSInfo
        img.save(out, format="JPEG", exif=data)
    else:
        img.save(out, format="JPEG")
    return out.getvalue()


async def onboarded_user(client: httpx.AsyncClient) -> dict[str, str]:
    """Daftar + selesaikan onboarding; mengembalikan header auth."""
    headers = auth_header(await register(client))
    options = (await client.get("/api/v1/me/onboarding/options", headers=headers)).json()
    await client.put(
        "/api/v1/me/onboarding",
        json={
            "function_id": options["functions"][0]["id"],
            "interests": [options["categories"][0]["id"]],
            "daily_target_minutes": 15,
            "timezone": "Asia/Jakarta",
        },
        headers=headers,
    )
    return headers


async def category_id(
    client: httpx.AsyncClient, headers: dict[str, str], code: str = "fiksi"
) -> str:
    options = (await client.get("/api/v1/me/onboarding/options", headers=headers)).json()
    return next(c["id"] for c in options["categories"] if c["code"] == code)


async def create_book(client: httpx.AsyncClient, headers: dict[str, str], **overrides) -> dict:
    payload = {
        "title": f"Buku {uuid.uuid4().hex[:6]}",
        "authors": ["Penulis Uji"],
        "category_id": await category_id(client, headers),
        **overrides,
    }
    response = await client.post("/api/v1/books", json=payload, headers=headers)
    assert response.status_code in (200, 201), response.text
    return response.json()


async def upload_photo(client: httpx.AsyncClient, headers: dict[str, str]) -> dict:
    response = await client.post(
        "/api/v1/uploads/photos",
        files={"file": ("buku.jpg", jpeg_bytes(), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def read_for(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    fake_clock: FakeClock,
    session_id: str,
    minutes: float,
) -> dict:
    """Simulasikan membaca aktif dengan heartbeat tiap 15 detik."""
    body = {}
    for _ in range(int(minutes * 4)):
        fake_clock.advance(seconds=15)
        response = await client.post(
            f"/api/v1/sessions/{session_id}/heartbeat", json={"state": "active"}, headers=headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
    return body
