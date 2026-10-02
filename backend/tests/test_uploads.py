import io

from PIL import Image

from tests.conftest import jpeg_bytes, onboarded_user


async def test_upload_strips_exif_and_serves_signed_url(client):
    headers = await onboarded_user(client)
    response = await client.post(
        "/api/v1/uploads/photos",
        files={"file": ("foto.jpg", jpeg_bytes(exif=True), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["key"].startswith("photos/")

    media = await client.get(body["url"])
    assert media.status_code == 200
    assert media.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(media.content)) as img:
        assert dict(img.getexif()) == {}


async def test_upload_rejects_non_image(client):
    headers = await onboarded_user(client)
    response = await client.post(
        "/api/v1/uploads/photos",
        files={"file": ("x.jpg", b"not an image at all", "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 415


async def test_upload_rejects_too_large(client, database):
    headers = await onboarded_user(client)
    await database["app_settings"].update_one(
        {"key": "upload.max_bytes"}, {"$set": {"value": 1000}}
    )
    try:
        response = await client.post(
            "/api/v1/uploads/photos",
            files={"file": ("big.jpg", jpeg_bytes((800, 800)), "image/jpeg")},
            headers=headers,
        )
        assert response.status_code == 413
    finally:
        await database["app_settings"].update_one(
            {"key": "upload.max_bytes"}, {"$set": {"value": 1048576}}
        )


async def test_upload_requires_auth(client):
    response = await client.post(
        "/api/v1/uploads/photos", files={"file": ("a.jpg", jpeg_bytes(), "image/jpeg")}
    )
    assert response.status_code == 401


async def test_media_rejects_bad_signature(client):
    headers = await onboarded_user(client)
    body = (
        await client.post(
            "/api/v1/uploads/photos",
            files={"file": ("a.jpg", jpeg_bytes(), "image/jpeg")},
            headers=headers,
        )
    ).json()
    tampered = body["url"].replace("sig=", "sig=0")
    assert (await client.get(tampered)).status_code == 403


async def test_mongo_storage_put_get_overwrite(database):
    from app.core.storage import MongoStorage

    storage = MongoStorage()
    await storage.ensure_ready()
    assert await storage.get("photos/tidak-ada.jpg") is None
    await storage.put("photos/uji-mongo.jpg", b"abc", "image/jpeg")
    await storage.put("photos/uji-mongo.jpg", b"abcd", "image/webp")
    assert await storage.get("photos/uji-mongo.jpg") == (b"abcd", "image/webp")
    assert await database["media"].count_documents({"key": "photos/uji-mongo.jpg"}) == 1
    await database["media"].delete_one({"key": "photos/uji-mongo.jpg"})


async def test_upload_and_serve_with_mongo_backend(client, database, monkeypatch):
    from app.core import storage as storage_module

    monkeypatch.setattr(storage_module, "_storage", storage_module.MongoStorage())
    headers = await onboarded_user(client)
    response = await client.post(
        "/api/v1/uploads/photos",
        files={"file": ("foto.jpg", jpeg_bytes(), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    key = response.json()["key"]
    assert await database["media"].find_one({"key": key})
    media = await client.get(response.json()["url"])
    assert media.status_code == 200 and media.headers["content-type"] == "image/jpeg"
