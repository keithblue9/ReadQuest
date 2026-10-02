import pytest

from app.core.phone_pin import normalize_phone, validate_pin
from tests.conftest import (
    ADMIN_PHONE,
    ADMIN_PIN,
    USER_PIN,
    auth_header,
    first_function_id,
    register,
    unique_phone,
)


def login(client, phone: str, pin: str):
    return client.post("/api/v1/auth/login", json={"phone": phone, "pin": pin})


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.parametrize(
    "raw",
    ["081234567890", "6281234567890", "+62 812-3456-7890", "81234567890", "0062 81234567890"],
)
def test_normalize_phone(raw):
    assert normalize_phone(raw) == "+6281234567890"


@pytest.mark.parametrize("raw", ["", "12345", "08abc", "+0812345678"])
def test_normalize_phone_rejects_invalid(raw):
    with pytest.raises(ValueError):
        normalize_phone(raw)


@pytest.mark.parametrize(
    "pin", ["12345", "1234567", "12a456", "111111", "123456", "987654", "121212"]
)
def test_validate_pin_rejects_weak_or_malformed(pin):
    with pytest.raises(ValueError):
        validate_pin(pin)


def test_validate_pin_accepts_good_pin():
    assert validate_pin("482913") == "482913"


async def test_register_options_are_public(client):
    response = await client.get("/api/v1/auth/register-options")
    assert response.status_code == 200
    assert response.json()["functions"]


async def test_register_creates_member_with_function(client):
    function_id = await first_function_id(client)
    response = await register(client, name="  Rani   Putri ", function_id=function_id)
    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    user = body["user"]
    assert user["role"]["code"] == "member"
    assert user["name"] == "Rani Putri"
    assert user["function_id"] == function_id
    assert user["phone"].startswith("+62") and user["email"] is None
    assert user["onboarding_completed"] is False
    assert "post.create" in user["permissions"]
    cookie = response.headers["set-cookie"]
    assert "rq_refresh=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie
    assert "samesite=strict" in cookie.lower()


async def test_register_duplicate_phone_any_format(client):
    phone = unique_phone()  # 0812…
    assert (await register(client, phone=phone)).status_code == 201
    response = await register(client, phone="+62" + phone[1:])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "phone_taken"


async def test_register_validates_payload(client):
    response = await register(
        client,
        pin="123456",
        phone="12",
        timezone="Mars/Base",
        function_id="000000000000000000000000",
    )
    assert response.status_code == 422
    fields = {tuple(f["loc"]) for f in response.json()["error"]["fields"]}
    assert {("pin",), ("phone",), ("timezone",)} <= fields

    unknown_fn = await register(client, function_id="000000000000000000000000")
    assert unknown_fn.status_code == 422
    assert unknown_fn.json()["error"]["code"] == "invalid_function"


async def test_login_success_and_failure(client):
    phone = unique_phone()
    await register(client, phone=phone)

    ok = await login(client, "+62" + phone[1:], USER_PIN)  # format berbeda tetap cocok
    assert ok.status_code == 200

    wrong = await login(client, phone, "975310")
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "invalid_credentials"

    assert (await login(client, unique_phone(), USER_PIN)).status_code == 401


async def test_account_locks_after_repeated_wrong_pin(client, fake_clock):
    phone = unique_phone()
    await register(client, phone=phone)
    for attempt in range(4):
        assert (await login(client, phone, "975310")).status_code == 401, attempt
    fifth = await login(client, phone, "975310")
    assert fifth.status_code == 429
    assert fifth.json()["error"]["code"] == "account_locked"
    # Saat terkunci, PIN benar pun ditolak.
    assert (await login(client, phone, USER_PIN)).status_code == 429

    fake_clock.advance(minutes=16)
    assert (await login(client, phone, USER_PIN)).status_code == 200


async def test_successful_login_resets_failure_count(client, fake_clock):
    phone = unique_phone()
    await register(client, phone=phone)
    for _ in range(4):
        await login(client, phone, "975310")
    assert (await login(client, phone, USER_PIN)).status_code == 200
    for _ in range(4):
        assert (await login(client, phone, "975310")).status_code == 401


async def test_change_own_pin(client):
    phone = unique_phone()
    headers = auth_header(await register(client, phone=phone))
    wrong = await client.put(
        "/api/v1/me/pin", json={"current_pin": "975310", "new_pin": "482913"}, headers=headers
    )
    assert wrong.status_code == 422
    weak = await client.put(
        "/api/v1/me/pin", json={"current_pin": USER_PIN, "new_pin": "000000"}, headers=headers
    )
    assert weak.status_code == 422
    ok = await client.put(
        "/api/v1/me/pin", json={"current_pin": USER_PIN, "new_pin": "482913"}, headers=headers
    )
    assert ok.status_code == 204
    assert (await login(client, phone, USER_PIN)).status_code == 401
    assert (await login(client, phone, "482913")).status_code == 200


async def test_me_requires_valid_token(client):
    assert (await client.get("/api/v1/me")).status_code == 401
    bad = await client.get("/api/v1/me", headers={"Authorization": "Bearer abc"})
    assert bad.status_code == 401

    registered = await register(client)
    me = await client.get("/api/v1/me", headers=auth_header(registered))
    assert me.status_code == 200
    assert me.json()["phone"] == registered.json()["user"]["phone"]


async def test_refresh_rotates_and_detects_reuse(client):
    await register(client)
    first_cookie = client.cookies.get("rq_refresh")

    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    second_cookie = client.cookies.get("rq_refresh")
    assert second_cookie and second_cookie != first_cookie

    # Token lama dipakai ulang → seluruh family dicabut.
    client.cookies.set("rq_refresh", first_cookie, path="/api/v1/auth")
    reused = await client.post("/api/v1/auth/refresh")
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "refresh_reused"

    client.cookies.set("rq_refresh", second_cookie, path="/api/v1/auth")
    after_reuse = await client.post("/api/v1/auth/refresh")
    assert after_reuse.status_code == 401


async def test_refresh_without_cookie(client):
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


async def test_logout_revokes_refresh_token(client):
    await register(client)
    token = client.cookies.get("rq_refresh")

    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 204

    client.cookies.set("rq_refresh", token, path="/api/v1/auth")
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401


async def test_require_permission(client):
    member = await register(client)
    denied = await client.get("/test/admin-only", headers=auth_header(member))
    assert denied.status_code == 403

    admin = await client.post("/api/v1/auth/login", json={"phone": ADMIN_PHONE, "pin": ADMIN_PIN})
    assert admin.status_code == 200
    allowed = await client.get("/test/admin-only", headers=auth_header(admin))
    assert allowed.status_code == 200
