import io

import pytest
from PIL import Image

from app.services import notification_service
from tests.conftest import admin_headers, jpeg_bytes, onboarded_user


@pytest.fixture(autouse=True)
async def _clean_ui(database):
    yield
    await database["app_settings"].delete_many({"key": {"$regex": "^ui\\."}})


def png_with_alpha() -> bytes:
    out = io.BytesIO()
    Image.new("RGBA", (800, 800), (255, 0, 0, 0)).save(out, format="PNG")
    return out.getvalue()


async def test_public_config_has_defaults_without_login(client):
    response = await client.get("/api/v1/ui-config")
    assert response.status_code == 200
    body = response.json()
    assert body["branding"]["app_name"] == "ReadQuest"
    assert body["branding"]["logo_emoji"] == "📚"
    assert body["branding"]["logo_url"] is None
    assert body["login"] == {"interval_seconds": 6, "backgrounds": []}
    assert all(body["features"]["enabled"].values())
    assert body["features"]["menu_order"][0] == "dashboard"
    assert body["texts"] == {}


async def test_member_cannot_change_appearance(client):
    headers = await onboarded_user(client)
    response = await client.put(
        "/api/v1/admin/ui/branding",
        json={"value": {"app_name": "X", "tagline": "", "logo_emoji": "📖"}},
        headers=headers,
    )
    assert response.status_code == 403
    upload = await client.post(
        "/api/v1/admin/ui/images",
        files={"file": ("a.jpg", jpeg_bytes(), "image/jpeg")},
        headers=headers,
    )
    assert upload.status_code == 403


async def test_admin_updates_branding_and_logo(client, database):
    admin = await admin_headers(client)
    logo = await client.post(
        "/api/v1/admin/ui/images?kind=logo",
        files={"file": ("logo.png", png_with_alpha(), "image/png")},
        headers=admin,
    )
    assert logo.status_code == 201, logo.text
    logo_body = logo.json()
    assert logo_body["key"].startswith("ui/logo/") and logo_body["key"].endswith(".png")
    assert max(logo_body["width"], logo_body["height"]) <= 512

    response = await client.put(
        "/api/v1/admin/ui/branding",
        json={
            "value": {
                "app_name": "  BacaYuk ",
                "tagline": "Sedikit demi sedikit",
                "logo_emoji": "📖",
                "logo_key": logo_body["key"],
            }
        },
        headers=admin,
    )
    assert response.status_code == 200, response.text
    public = (await client.get("/api/v1/ui-config")).json()
    assert public["branding"]["app_name"] == "BacaYuk"
    assert public["branding"]["tagline"] == "Sedikit demi sedikit"
    image = await client.get(public["branding"]["logo_url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"

    audit = await database["audit_logs"].find_one({"entity_id": "ui.branding"})
    assert audit is not None and audit["action"] == "ui.update"


async def test_branding_validation(client):
    admin = await admin_headers(client)

    async def put(value):
        return await client.put("/api/v1/admin/ui/branding", json={"value": value}, headers=admin)

    assert (await put({"app_name": "", "logo_emoji": "📚"})).status_code == 422
    assert (await put({"app_name": "A" * 41, "logo_emoji": "📚"})).status_code == 422
    assert (
        await put({"app_name": "A", "logo_emoji": "📚", "logo_key": "photos/x/../y.jpg"})
    ).status_code == 422
    unknown = await client.put("/api/v1/admin/ui/unknown", json={"value": {}}, headers=admin)
    assert unknown.status_code == 404


async def test_login_backgrounds_slideshow(client):
    admin = await admin_headers(client)
    keys = []
    for _ in range(2):
        uploaded = await client.post(
            "/api/v1/admin/ui/images?kind=background",
            files={"file": ("bg.jpg", jpeg_bytes((3000, 2000), exif=True), "image/jpeg")},
            headers=admin,
        )
        assert uploaded.status_code == 201, uploaded.text
        body = uploaded.json()
        assert body["key"].startswith("ui/backgrounds/")
        assert body["width"] == 2400
        keys.append(body["key"])

    async def put(value):
        return await client.put("/api/v1/admin/ui/login", json={"value": value}, headers=admin)

    assert (await put({"background_keys": keys, "interval_seconds": 2})).status_code == 422
    assert (
        await put({"background_keys": ["photos/a.jpg"], "interval_seconds": 5})
    ).status_code == 422
    ok = await put({"background_keys": [keys[1], keys[0], keys[1]], "interval_seconds": 10})
    assert ok.status_code == 200, ok.text

    login = (await client.get("/api/v1/ui-config")).json()["login"]
    assert login["interval_seconds"] == 10
    assert [b["key"] for b in login["backgrounds"]] == [keys[1], keys[0]]
    served = await client.get(login["backgrounds"][0]["url"])
    assert served.status_code == 200 and served.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(served.content)) as img:
        assert dict(img.getexif()) == {}


async def test_image_upload_rejects_non_image(client):
    admin = await admin_headers(client)
    response = await client.post(
        "/api/v1/admin/ui/images?kind=background",
        files={"file": ("x.jpg", b"bukan gambar", "image/jpeg")},
        headers=admin,
    )
    assert response.status_code == 415
    bad_kind = await client.post(
        "/api/v1/admin/ui/images?kind=avatar",
        files={"file": ("x.jpg", jpeg_bytes(), "image/jpeg")},
        headers=admin,
    )
    assert bad_kind.status_code == 422


async def test_features_and_menu_order(client):
    admin = await admin_headers(client)

    async def put(value):
        return await client.put("/api/v1/admin/ui/features", json={"value": value}, headers=admin)

    assert (await put({"enabled": {"chat": False}})).status_code == 422
    assert (await put({"enabled": {"feed": "no"}})).status_code == 422
    assert (await put({"menu_order": ["admin"]})).status_code == 422
    ok = await put({"enabled": {"buddy": False}, "menu_order": ["books", "dashboard"]})
    assert ok.status_code == 200
    features = ok.json()["features"]
    assert features["enabled"]["buddy"] is False and features["enabled"]["feed"] is True
    assert features["menu_order"][:3] == ["books", "dashboard", "feed"]
    assert len(features["menu_order"]) == len(set(features["menu_order"]))


async def test_text_overrides(client, database):
    admin = await admin_headers(client)

    async def put(value):
        return await client.put("/api/v1/admin/ui/texts", json={"value": value}, headers=admin)

    assert (await put({"Bad Key": "x"})).status_code == 422
    assert (await put({"login.title": "x" * 501})).status_code == 422
    assert (await put({"login.title": "Ayo masuk", "nav.feed": "Linimasa"})).status_code == 200
    assert (await put({"login.title": "Ayo masuk"})).status_code == 200
    texts = (await client.get("/api/v1/ui-config")).json()["texts"]
    assert texts == {"login.title": "Ayo masuk"}

    # Audit log teks hanya mencatat kunci yang berubah.
    audit = await database["audit_logs"].find_one(
        {"entity_id": "ui.texts"}, sort=[("created_at", -1), ("_id", -1)]
    )
    assert audit["before"] == {"nav.feed": "Linimasa"}
    assert audit["after"] == {"nav.feed": None}


async def test_push_feature_off_skips_push(client, database):
    headers = await onboarded_user(client)
    user = await database["users"].find_one({}, sort=[("_id", -1)])
    admin = await admin_headers(client)
    off = await client.put(
        "/api/v1/admin/ui/features", json={"value": {"enabled": {"push": False}}}, headers=admin
    )
    assert off.status_code == 200
    note_id = await notification_service.notify(
        database, user_id=user["_id"], type_="streak_at_risk"
    )
    doc = await database["notifications"].find_one({"_id": note_id})
    assert doc["push_status"] == "skipped" and doc["in_app"] is True
    assert headers  # user aktif


def test_split_brand():
    from app.services.ui_config_service import split_brand

    assert split_brand("ReadQuest") == ("Read", "Quest")
    assert split_brand("Baca Bareng Yuk") == ("Baca Bareng ", "Yuk")
    assert split_brand("pustaka") == ("pustaka", "")
    assert split_brand("ABC") == ("ABC", "")
