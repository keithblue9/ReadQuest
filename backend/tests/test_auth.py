from datetime import UTC, datetime, timedelta

from tests.conftest import auth_header, register, unique_email


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200


async def test_register_with_valid_invite(client):
    response = await register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["role"]["code"] == "member"
    assert body["user"]["onboarding_completed"] is False
    assert "post.create" in body["user"]["permissions"]
    cookie = response.headers["set-cookie"]
    assert "rq_refresh=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie
    assert "samesite=strict" in cookie.lower()


async def test_register_invite_code_is_case_insensitive(client):
    response = await register(client, invite_code=" testcode ")
    assert response.status_code == 201


async def test_register_rejects_unknown_invite(client):
    response = await register(client, invite_code="NOPE1234")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_invite_code"


async def test_register_rejects_expired_invite(client, database):
    member = await database["roles"].find_one({"code": "member"})
    await database["invite_codes"].insert_one(
        {
            "code": "EXPIRED1",
            "default_role_id": member["_id"],
            "default_function_id": None,
            "max_uses": None,
            "used_count": 0,
            "expires_at": datetime.now(UTC) - timedelta(days=1),
            "is_active": True,
        }
    )
    response = await register(client, invite_code="EXPIRED1")
    assert response.status_code == 400


async def test_register_respects_max_uses(client, database):
    lead = await database["roles"].find_one({"code": "team_lead"})
    await database["invite_codes"].insert_one(
        {
            "code": "ONCEONLY",
            "default_role_id": lead["_id"],
            "default_function_id": None,
            "max_uses": 1,
            "used_count": 0,
            "expires_at": None,
            "is_active": True,
        }
    )
    first = await register(client, invite_code="ONCEONLY")
    assert first.status_code == 201
    assert first.json()["user"]["role"]["code"] == "team_lead"

    second = await register(client, invite_code="ONCEONLY")
    assert second.status_code == 400
    invite = await database["invite_codes"].find_one({"code": "ONCEONLY"})
    assert invite["used_count"] == 1


async def test_register_duplicate_email(client):
    email = unique_email()
    assert (await register(client, email=email)).status_code == 201
    response = await register(client, email=email.upper())
    assert response.status_code == 409


async def test_register_validates_payload(client):
    response = await register(client, password="short", timezone="Mars/Base")
    assert response.status_code == 422
    fields = {tuple(f["loc"]) for f in response.json()["error"]["fields"]}
    assert ("password",) in fields
    assert ("timezone",) in fields


async def test_login_success_and_failure(client):
    email = unique_email()
    await register(client, email=email)

    ok = await client.post("/api/v1/auth/login", json={"email": email, "password": "rahasia-123"})
    assert ok.status_code == 200

    wrong = await client.post("/api/v1/auth/login", json={"email": email, "password": "salah-123"})
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "invalid_credentials"

    unknown = await client.post(
        "/api/v1/auth/login", json={"email": unique_email(), "password": "rahasia-123"}
    )
    assert unknown.status_code == 401


async def test_login_rate_limited_per_email(client):
    email = unique_email()
    for _ in range(5):
        await client.post("/api/v1/auth/login", json={"email": email, "password": "x"})
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": "x"})
    assert response.status_code == 429


async def test_me_requires_valid_token(client):
    assert (await client.get("/api/v1/me")).status_code == 401
    bad = await client.get("/api/v1/me", headers={"Authorization": "Bearer abc"})
    assert bad.status_code == 401

    registered = await register(client)
    me = await client.get("/api/v1/me", headers=auth_header(registered))
    assert me.status_code == 200
    assert me.json()["email"] == registered.json()["user"]["email"]


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

    admin = await client.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": "admin-pass-123"}
    )
    assert admin.status_code == 200
    allowed = await client.get("/test/admin-only", headers=auth_header(admin))
    assert allowed.status_code == 200
