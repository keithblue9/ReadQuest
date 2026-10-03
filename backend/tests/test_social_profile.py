"""Rak buku, reaksi "Mau baca juga", profil publik, foto profil, kutipan, laporan divisi, badge."""

import io
import uuid

from bson import ObjectId
from PIL import Image

from tests.conftest import (
    admin_headers,
    create_book,
    jpeg_bytes,
    me,
    onboarded_user,
    quick_post,
)


def note(seed: str) -> str:
    return (
        f"Catatan {seed}: bab ini membahas cara membangun kebiasaan membaca bersama tim. "
        "Saya mencatat tiga ide praktis yang ingin dicoba minggu ini, mulai dari menaruh buku "
        "di meja kerja sampai membaca lima belas menit sebelum rapat pagi dimulai."
    )


async def test_shelf_follows_activity_and_manual_changes(client):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    other = await create_book(client, headers)

    await quick_post(client, headers, book["id"], note(uuid.uuid4().hex))
    shelf = (await client.get("/api/v1/me/shelf", headers=headers)).json()
    assert [(i["book"]["id"], i["status"]) for i in shelf["items"]] == [(book["id"], "reading")]

    await quick_post(client, headers, book["id"], note(uuid.uuid4().hex), is_book_finished=True)
    finished = (await client.get("/api/v1/me/shelf?status=finished", headers=headers)).json()
    assert finished["items"][0]["book"]["id"] == book["id"]
    assert finished["counts"]["finished"] == 1 and finished["counts"]["reading"] == 0

    # Mulai sesi lagi pada buku yang sudah selesai tidak menurunkan statusnya.
    started = await client.post("/api/v1/sessions", json={"book_id": book["id"]}, headers=headers)
    await client.post(f"/api/v1/sessions/{started.json()['id']}/abandon", headers=headers)
    again = (await client.get("/api/v1/me/shelf", headers=headers)).json()
    assert again["items"][0]["status"] == "finished"

    put = await client.put(
        f"/api/v1/me/shelf/{other['id']}", json={"status": "want"}, headers=headers
    )
    assert put.status_code == 204
    missing = await client.put(
        f"/api/v1/me/shelf/{ObjectId()}", json={"status": "want"}, headers=headers
    )
    assert missing.status_code == 404
    counts = (await client.get("/api/v1/me/shelf", headers=headers)).json()["counts"]
    assert counts == {"reading": 0, "want": 1, "finished": 1}
    await client.delete(f"/api/v1/me/shelf/{other['id']}", headers=headers)
    counts = (await client.get("/api/v1/me/shelf", headers=headers)).json()["counts"]
    assert counts["want"] == 0

    # Rak terlihat oleh rekan.
    viewer = await onboarded_user(client)
    owner_id = (await me(client, headers))["id"]
    public = (await client.get(f"/api/v1/users/{owner_id}/shelf", headers=viewer)).json()
    assert public["counts"]["finished"] == 1


async def test_want_to_read_reaction_adds_to_shelf(client):
    author = await onboarded_user(client)
    reader = await onboarded_user(client)
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note(uuid.uuid4().hex)))["post"]

    reacted = await client.put(
        f"/api/v1/posts/{post['id']}/reaction", json={"type": "want_to_read"}, headers=reader
    )
    assert reacted.status_code == 200
    assert reacted.json()["counts"]["want_to_read"] == 1
    shelf = (await client.get("/api/v1/me/shelf?status=want", headers=reader)).json()
    assert shelf["items"][0]["book"]["id"] == book["id"]

    switched = await client.put(
        f"/api/v1/posts/{post['id']}/reaction", json={"type": "insightful"}, headers=reader
    )
    counts = switched.json()["counts"]
    assert counts["want_to_read"] == 0 and counts["insightful"] == 1


async def test_public_profile_and_editing(client):
    headers = await onboarded_user(client)
    viewer = await onboarded_user(client)
    book = await create_book(client, headers)
    await quick_post(client, headers, book["id"], note(uuid.uuid4().hex))

    bad = await client.patch(
        "/api/v1/me", json={"favorite_book_ids": [str(ObjectId())]}, headers=headers
    )
    assert bad.status_code == 422
    updated = await client.patch(
        "/api/v1/me",
        json={
            "headline": "  Analis keuangan · suka buku bisnis ",
            "favorite_book_ids": [book["id"]],
        },
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["headline"] == "Analis keuangan · suka buku bisnis"

    user_id = updated.json()["id"]
    profile = (await client.get(f"/api/v1/users/{user_id}", headers=viewer)).json()
    assert profile["headline"] == "Analis keuangan · suka buku bisnis"
    assert profile["function"] and profile["is_me"] is False
    assert profile["favorite_books"][0]["id"] == book["id"]
    assert profile["currently_reading"][0]["id"] == book["id"]
    assert profile["stats"]["reading_minutes"] == 15
    assert profile["stats"]["current_streak"] == 1
    assert "authenticity" not in str(profile).lower()

    assert (await client.get(f"/api/v1/users/{ObjectId()}", headers=viewer)).status_code == 404


async def test_avatar_upload_is_square_and_public(client):
    headers = await onboarded_user(client)
    response = await client.post(
        "/api/v1/me/avatar",
        files={"file": ("me.jpg", jpeg_bytes((800, 500), exif=True), "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    url = response.json()["avatar_url"]
    assert url.startswith("/api/v1/avatars/") and url.endswith(".jpg")

    served = await client.get(url)  # tanpa login: dipakai di <img>
    assert served.status_code == 200
    with Image.open(io.BytesIO(served.content)) as img:
        assert img.size == (256, 256)
        assert dict(img.getexif()) == {}
    assert (await client.get("/api/v1/avatars/../../etc.jpg")).status_code == 404
    assert (await client.get("/api/v1/avatars/abc.jpg")).status_code == 404

    # Foto terbaru muncul di posting lama.
    book = await create_book(client, headers)
    post = (await quick_post(client, headers, book["id"], note(uuid.uuid4().hex)))["post"]
    assert post["author"]["avatar_url"] == url

    removed = await client.delete("/api/v1/me/avatar", headers=headers)
    assert removed.json()["avatar_url"] is None


async def test_quote_post_and_share_card(client):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    response = await client.post(
        f"/api/v1/books/{book['id']}/quotes",
        json={
            "text": "“Kebiasaan adalah bunga majemuk dari perbaikan diri.”",
            "page": 18,
            "reflection": "Pengingat bahwa 15 menit sehari itu berarti.",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    post = response.json()
    assert post["type"] == "quote"
    assert post["quote"] == {
        "text": "Kebiasaan adalah bunga majemuk dari perbaikan diri.",
        "page": 18,
    }
    ledger = await client.get("/api/v1/me/points/history", headers=headers)
    assert any(e["rule_code"] == "quote_shared" for e in ledger.json()["items"])

    card = await client.get(f"/api/v1/posts/{post['id']}/share-card.png", headers=headers)
    assert card.status_code == 200 and card.headers["content-type"] == "image/png"

    duplicate = await client.post(
        f"/api/v1/books/{book['id']}/quotes",
        json={
            "text": "Kebiasaan adalah bunga majemuk dari perbaikan diri.",
            "page": 18,
            "reflection": "Pengingat bahwa 15 menit sehari itu berarti.",
        },
        headers=headers,
    )
    assert duplicate.status_code == 422
    too_short = await client.post(
        f"/api/v1/books/{book['id']}/quotes", json={"text": "Halo....."}, headers=headers
    )
    assert too_short.status_code == 422


async def test_participation_report_is_aggregate_and_exportable(client, database):
    member = await onboarded_user(client)
    assert (await client.get("/api/v1/reports/participation", headers=member)).status_code == 403

    book = await create_book(client, member)
    await quick_post(client, member, book["id"], note(uuid.uuid4().hex))

    admin = await admin_headers(client)
    report = (await client.get("/api/v1/reports/participation?weeks=4", headers=admin)).json()
    assert len(report["weeks"]) == 4 and len(report["overall"]) == 4
    assert report["overall"][-1]["readers"] >= 1
    for row in report["functions"]:
        assert set(row["series"][0]) == {
            "week",
            "members",
            "readers",
            "rate",
            "minutes",
            "avg_minutes_per_member",
        }
        assert "name" not in str(row).lower()

    # Fungsi kecil digabung agar tidak bisa ditelusuri ke individu.
    await database["app_settings"].update_one(
        {"key": "reports.min_group_size"}, {"$set": {"value": 50}}
    )
    try:
        merged = (await client.get("/api/v1/reports/participation", headers=admin)).json()
        assert [r["function"] for r in merged["functions"]] == ["Fungsi kecil (digabung)"]
    finally:
        await database["app_settings"].update_one(
            {"key": "reports.min_group_size"}, {"$set": {"value": 3}}
        )

    csv_file = await client.get("/api/v1/reports/participation.csv", headers=admin)
    assert csv_file.status_code == 200
    assert csv_file.content.decode("utf-8-sig").startswith("Fungsi,Minggu,Anggota")
    xlsx = await client.get("/api/v1/reports/participation.xlsx", headers=admin)
    assert xlsx.content[:2] == b"PK"
    assert await database["audit_logs"].find_one({"action": "report.participation.xlsx"})


async def test_team_lead_role_gets_reports_permission(database):
    role = await database["roles"].find_one({"code": "team_lead"})
    assert "reports.view" in role["permission_codes"]


async def test_badge_certificate_card(client):
    headers = await onboarded_user(client)
    badges = (await client.get("/api/v1/me/badges", headers=headers)).json()
    locked = next(b for b in badges if not b["earned"])
    missing = await client.get(f"/api/v1/me/badges/{locked['id']}/card.png", headers=headers)
    assert missing.status_code == 404

    book = await create_book(client, headers)
    await quick_post(client, headers, book["id"], note(uuid.uuid4().hex))
    badges = (await client.get("/api/v1/me/badges", headers=headers)).json()
    earned = next(b for b in badges if b["earned"])
    card = await client.get(f"/api/v1/me/badges/{earned['id']}/card.png", headers=headers)
    assert card.status_code == 200
    with Image.open(io.BytesIO(card.content)) as img:
        assert img.size == (1200, 628)
