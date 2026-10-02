from tests.conftest import auth_header, register


async def _options(client, headers):
    response = await client.get("/api/v1/me/onboarding/options", headers=headers)
    assert response.status_code == 200
    return response.json()


async def test_onboarding_options(client):
    headers = auth_header(await register(client))
    options = await _options(client, headers)
    assert len(options["functions"]) >= 1
    assert len(options["categories"]) >= 1
    assert options["daily_target_min_minutes"] == 15


async def test_complete_onboarding(client):
    headers = auth_header(await register(client))
    options = await _options(client, headers)
    payload = {
        "function_id": options["functions"][0]["id"],
        "interests": [c["id"] for c in options["categories"][:3]],
        "daily_target_minutes": 30,
        "timezone": "Asia/Makassar",
    }
    response = await client.put("/api/v1/me/onboarding", json=payload, headers=headers)
    assert response.status_code == 200
    me = response.json()
    assert me["onboarding_completed"] is True
    assert me["function_id"] == payload["function_id"]
    assert me["interests"] == payload["interests"]
    assert me["daily_target_minutes"] == 30
    assert me["timezone"] == "Asia/Makassar"


async def test_onboarding_rejects_invalid_values(client):
    headers = auth_header(await register(client))
    options = await _options(client, headers)
    base = {
        "function_id": options["functions"][0]["id"],
        "interests": [options["categories"][0]["id"]],
        "daily_target_minutes": 20,
        "timezone": "Asia/Jakarta",
    }

    below_min = await client.put(
        "/api/v1/me/onboarding", json={**base, "daily_target_minutes": 5}, headers=headers
    )
    assert below_min.status_code == 422
    assert below_min.json()["error"]["code"] == "invalid_daily_target"

    unknown_function = await client.put(
        "/api/v1/me/onboarding",
        json={**base, "function_id": "0" * 24},
        headers=headers,
    )
    assert unknown_function.status_code == 422
    assert unknown_function.json()["error"]["code"] == "invalid_function"

    unknown_interest = await client.put(
        "/api/v1/me/onboarding", json={**base, "interests": ["f" * 24]}, headers=headers
    )
    assert unknown_interest.status_code == 422

    bad_id = await client.put(
        "/api/v1/me/onboarding", json={**base, "function_id": "abc"}, headers=headers
    )
    assert bad_id.status_code == 422

    no_interest = await client.put(
        "/api/v1/me/onboarding", json={**base, "interests": []}, headers=headers
    )
    assert no_interest.status_code == 422


async def test_update_me(client):
    headers = auth_header(await register(client))
    response = await client.patch("/api/v1/me", json={"name": "Nama Baru"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Nama Baru"
