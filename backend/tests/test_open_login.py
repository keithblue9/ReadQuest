"""Mode masuk tanpa PIN (`auth.open_login`): pilih nama → langsung masuk."""

from bson import ObjectId

from tests.conftest import admin_headers, auth_header, first_function_id, register

SETTING = "auth.open_login"


async def _set_open(client, value) -> int:
    admin = await admin_headers(client)
    response = await client.put(
        f"/api/v1/admin/settings/{SETTING}", json={"value": value}, headers=admin
    )
    return response.status_code


async def test_open_login_is_on_by_default(client):
    body = (await client.get("/api/v1/auth/register-options")).json()
    assert body["open_login"] is True


async def test_members_list_is_public_and_hides_phone(client):
    created = await register(client, name="Sinta Wulandari")
    assert created.status_code == 201
    response = await client.get("/api/v1/auth/members")
    assert response.status_code == 200
    members = response.json()
    names = [m["name"] for m in members]
    assert "Sinta Wulandari" in names
    assert names == sorted(names, key=str.casefold)
    for m in members:
        assert set(m) == {"id", "name", "function", "avatar_url"}


async def test_enter_issues_tokens_without_pin(client):
    created = (await register(client, name="Bayu Prakoso")).json()
    user_id = created["user"]["id"]
    response = await client.post("/api/v1/auth/enter", json={"user_id": user_id})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["id"] == user_id
    assert "rq_refresh" in response.cookies
    me = await client.get("/api/v1/me", headers=auth_header(response))
    assert me.json()["name"] == "Bayu Prakoso"


async def test_enter_rejects_unknown_and_suspended_users(client, database):
    assert (
        await client.post("/api/v1/auth/enter", json={"user_id": str(ObjectId())})
    ).status_code == 404
    created = (await register(client, name="Akun Nonaktif")).json()
    user_id = created["user"]["id"]
    await database["users"].update_one(
        {"_id": ObjectId(user_id)}, {"$set": {"status": "suspended"}}
    )
    response = await client.post("/api/v1/auth/enter", json={"user_id": user_id})
    assert response.status_code == 403
    listed = [m["id"] for m in (await client.get("/api/v1/auth/members")).json()]
    assert user_id not in listed


async def test_quick_register_needs_only_name_and_function(client, database):
    function_id = await first_function_id(client)
    response = await client.post(
        "/api/v1/auth/quick-register", json={"name": "  Dimas   Arya ", "function_id": function_id}
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["name"] == "Dimas Arya"
    stored = await database["users"].find_one({"_id": ObjectId(body["user"]["id"])})
    assert stored["phone"] is None and stored["password_hash"] is None
    names = [m["name"] for m in (await client.get("/api/v1/auth/members")).json()]
    assert "Dimas Arya" in names


async def test_quick_register_validates_function(client):
    response = await client.post(
        "/api/v1/auth/quick-register", json={"name": "Tanpa Fungsi", "function_id": str(ObjectId())}
    )
    assert response.status_code == 422


async def test_turning_open_login_off_restores_pin_only(client):
    created = await register(client, name="Pengguna PIN")
    user_id = created.json()["user"]["id"]
    function_id = await first_function_id(client)
    assert await _set_open(client, False) == 200
    try:
        assert (await client.get("/api/v1/auth/register-options")).json()["open_login"] is False
        assert (await client.get("/api/v1/auth/members")).status_code == 403
        assert (
            await client.post("/api/v1/auth/enter", json={"user_id": user_id})
        ).status_code == 403
        assert (
            await client.post(
                "/api/v1/auth/quick-register", json={"name": "Coba", "function_id": function_id}
            )
        ).status_code == 403
        # Login PIN tetap jalan.
        assert (await admin_headers(client))["Authorization"].startswith("Bearer ")
    finally:
        assert await _set_open(client, True) == 200


async def test_open_login_setting_is_validated(client):
    assert await _set_open(client, "ya") == 422
    assert await _set_open(client, True) == 200


async def test_admin_gives_pinless_account_a_phone_and_pin(client):
    function_id = await first_function_id(client)
    created = await client.post(
        "/api/v1/auth/quick-register", json={"name": "Tanpa Nomor", "function_id": function_id}
    )
    user_id = created.json()["user"]["id"]
    admin = await admin_headers(client)
    url = f"/api/v1/admin/users/{user_id}/pin"

    # Akun tanpa nomor HP: nomor wajib diisi bersama PIN.
    missing = await client.put(url, json={"pin": "482913"}, headers=admin)
    assert missing.status_code == 422
    taken = await client.put(url, json={"pin": "482913", "phone": "081100000001"}, headers=admin)
    assert taken.status_code == 409

    ok = await client.put(url, json={"pin": "482913", "phone": "0812 9988 7766"}, headers=admin)
    assert ok.status_code == 204, ok.text
    login = await client.post("/api/v1/auth/login", json={"phone": "081299887766", "pin": "482913"})
    assert login.status_code == 200
    assert login.json()["user"]["id"] == user_id
