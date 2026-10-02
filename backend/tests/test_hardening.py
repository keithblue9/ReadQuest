import pytest
from pydantic import ValidationError

from app.core.config import Settings

STRONG = "s" * 40


async def test_security_headers_and_no_store(client):
    res = await client.get("/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["cache-control"] == "no-store"


async def test_body_too_large_rejected(client):
    huge = b"x" * (12 * 1024 * 1024 + 1)
    res = await client.post(
        "/api/v1/auth/login", content=huge, headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "payload_too_large"


async def test_streamed_body_too_large_rejected(client):
    async def chunks():
        for _ in range(13):
            yield b"x" * (1024 * 1024)

    res = await client.post(
        "/api/v1/auth/login", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert res.status_code in {400, 413}


def _prod(**overrides) -> Settings:
    values = {
        "app_env": "production",
        "jwt_secret": STRONG,
        "cookie_secure": True,
        "frontend_origin": "https://baca.example.com",
        "storage_backend": "s3",
        "s3_access_key": "key",
        "s3_secret_key": "secret-value",
        **overrides,
    }
    return Settings(_env_file=None, **values)


def test_production_settings_validation():
    assert _prod().app_env == "production"
    for bad in (
        {"jwt_secret": "pendek"},
        {"cookie_secure": False},
        {"frontend_origin": "http://baca.example.com"},
        {"s3_access_key": None},
    ):
        with pytest.raises(ValidationError):
            _prod(**bad)
    assert _prod(storage_backend="local", s3_access_key=None).storage_backend == "local"
