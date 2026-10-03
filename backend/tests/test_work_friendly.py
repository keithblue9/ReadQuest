"""Fitur untuk pekerja sibuk: sesi kilat, Takeaway 1 menit, target mingguan, pengingat cerdas."""

import uuid

from bson import ObjectId

from app.core import db as db_module
from app.services.notification_service import habit_time_from
from tests.conftest import admin_headers, create_book, onboarded_user, quick_post


def takeaway(seed: str) -> str:
    return f"Insight {seed}: rapat singkat lebih efektif bila agendanya ditulis sebelumnya."


def note(seed: str) -> str:
    return (
        f"Catatan {seed}: bab ini membahas cara membangun kebiasaan membaca bersama tim. "
        "Saya mencatat tiga ide praktis yang ingin dicoba minggu ini, mulai dari menaruh buku "
        "di meja kerja sampai membaca lima belas menit sebelum rapat pagi dimulai."
    )


async def micro(client, headers, book_id, seconds, content=None, **extra):
    started = await client.post(
        "/api/v1/sessions", json={"book_id": book_id, "mode": "micro"}, headers=headers
    )
    assert started.status_code == 201, started.text
    body = started.json()
    assert body["mode"] == "micro" and body["min_seconds"] == 300
    await db_module.get_db()["reading_sessions"].update_one(
        {"_id": ObjectId(body["id"])}, {"$set": {"active_seconds": seconds, "status": "paused"}}
    )
    return await client.post(
        f"/api/v1/sessions/{body['id']}/finish",
        json={
            "note_type": "takeaway",
            "takeaway_kind": "insight",
            "content": content or takeaway(uuid.uuid4().hex[:6]),
            **extra,
        },
        headers=headers,
    )


def codes(result) -> dict[str, int]:
    return {a["rule_code"]: a["points"] for a in result["points"]["awarded"]}


async def test_micro_sessions_add_up_to_full_points(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)

    too_short = await micro(client, headers, book["id"], 120)
    assert too_short.status_code == 422
    assert too_short.json()["error"]["code"] == "session_too_short"
    open_session = (await client.get("/api/v1/sessions/today", headers=headers)).json()
    await client.post(
        f"/api/v1/sessions/{open_session['active_session']['id']}/abandon", headers=headers
    )

    first = await micro(client, headers, book["id"], 300)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["post"]["type"] == "takeaway" and body["post"]["takeaway_kind"] == "insight"
    assert body["post"]["image_urls"] == []
    assert codes(body) == {"micro_session": 3, "post_feed": 10}
    assert body["session"]["is_full_points"] is False

    second = (await micro(client, headers, book["id"], 300)).json()
    assert "session_valid" not in codes(second)

    # 3 × 5 menit = 15 menit → sesi ketiga mendapat poin penuh harian + streak.
    third = (await micro(client, headers, book["id"], 300)).json()
    assert codes(third)["session_valid"] == 20
    assert third["session"]["is_full_points"] is True
    assert third["points"]["streak"]["current"] == 1

    today = (await client.get("/api/v1/sessions/today", headers=headers)).json()
    assert today["minutes_today"] == 15 and today["full_points_done"] is True


async def test_standard_session_still_needs_full_duration_and_photo(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    started = (
        await client.post("/api/v1/sessions", json={"book_id": book["id"]}, headers=headers)
    ).json()
    await db_module.get_db()["reading_sessions"].update_one(
        {"_id": ObjectId(started["id"])}, {"$set": {"active_seconds": 600, "status": "paused"}}
    )
    short = await client.post(
        f"/api/v1/sessions/{started['id']}/finish",
        json={"note_type": "takeaway", "content": takeaway("x")},
        headers=headers,
    )
    assert short.json()["error"]["code"] == "session_too_short"

    no_photo = await client.post(
        f"/api/v1/sessions/{started['id']}/finish",
        json={"note_type": "quick_note", "content": note("tanpa-foto")},
        headers=headers,
    )
    assert no_photo.status_code == 422


async def test_takeaway_needs_minimum_words(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    response = await micro(client, headers, book["id"], 300, content="Bagus sekali.")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "note_rejected"


async def test_weekly_target_mode_and_bonus(client, fake_clock):
    headers = await onboarded_user(client)
    bad = await client.patch("/api/v1/me", json={"daily_target_minutes": 5}, headers=headers)
    assert bad.status_code == 422

    me = await client.patch(
        "/api/v1/me",
        json={"target_mode": "weekly", "weekly_target_minutes": 30},
        headers=headers,
    )
    assert me.status_code == 200
    assert me.json()["target_mode"] == "weekly" and me.json()["weekly_target_minutes"] == 30

    book = await create_book(client, headers)
    first = await quick_post(client, headers, book["id"], note("satu"))
    assert "weekly_target" not in codes(first)
    fake_clock.advance(days=1)  # tetap minggu yang sama (Senin → Selasa)
    second = await quick_post(client, headers, book["id"], note("dua"))
    assert codes(second)["weekly_target"] == 50

    progress = (await client.get("/api/v1/me/progress", headers=headers)).json()
    assert progress["target_mode"] == "weekly"
    assert progress["week_minutes"] == 30 and progress["weekly_met"] is True
    assert len(progress["days"]) == 7 and progress["days"][0]["date"] == progress["week_start"]

    # Bonus hanya sekali per minggu.
    fake_clock.advance(days=1)
    third = await quick_post(client, headers, book["id"], note("tiga"))
    assert "weekly_target" not in codes(third)


def test_habit_time_from_sessions():
    assert habit_time_from([19 * 60, 20 * 60]) is None  # data belum cukup
    # median 19:40 − 30 menit = 19:10 → dibulatkan ke bawah per 15 menit = 19:00
    assert habit_time_from([19 * 60 + 40, 19 * 60 + 40, 21 * 60]) == "19:00"
    assert habit_time_from([5 * 60, 5 * 60, 5 * 60]) == "06:00"  # tidak sebelum jam 6 pagi


async def test_smart_reminder_preference(client, fake_clock):
    headers = await onboarded_user(client)
    prefs = (await client.get("/api/v1/me/notification-preferences", headers=headers)).json()
    assert prefs["smart_reminder"] is True and prefs["smart_reminder_time"] is None

    book = await create_book(client, headers)
    for i in range(3):
        await quick_post(client, headers, book["id"], note(f"kebiasaan-{i}"))
        fake_clock.advance(days=1)
    # Cache kebiasaan dihitung per hari; hari baru → dihitung ulang.
    prefs = (await client.get("/api/v1/me/notification-preferences", headers=headers)).json()
    assert prefs["smart_reminder_time"] == "08:30"  # sesi mulai 09:00 WIB − 30 menit

    saved = await client.put(
        "/api/v1/me/notification-preferences", json={"smart_reminder": False}, headers=headers
    )
    assert saved.json()["smart_reminder"] is False


async def test_new_settings_are_validated(client):
    admin = await admin_headers(client)

    async def put(key, value):
        return await client.put(
            f"/api/v1/admin/settings/{key}", json={"value": value}, headers=admin
        )

    assert (await put("streak.freezes_per_month", 11)).status_code == 422
    assert (await put("session.micro_min_minutes", 0)).status_code == 422
    assert (await put("note.min_words", {"takeaway": 8})).status_code == 422
    ok = await put(
        "note.min_words",
        {"quick_note": 30, "chapter_story": 80, "book_review": 200, "takeaway": 8},
    )
    assert ok.status_code == 200
