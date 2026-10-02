import uuid
from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId
from pywebpush import WebPushException

from app.core import db as db_module
from app.core.config import get_settings
from app.jobs import notification_jobs, scheduler
from app.services import notification_service, push_service
from tests.conftest import create_book, me, onboarded_user, quick_post


def note() -> str:
    return (
        f"Catatan {uuid.uuid4().hex}: penulis menjelaskan bagaimana kebiasaan kecil yang konsisten "
        "membentuk identitas baru. Saya mencatat tiga ide yang ingin dicoba bersama tim "
        "minggu ini, "
        "mulai dari menaruh buku di meja kerja sampai membaca sebelum rapat pagi dimulai."
    )


def at(fake_clock, iso: str) -> None:
    fake_clock.current = datetime.fromisoformat(iso).astimezone(UTC)


async def inbox(client, headers) -> dict:
    return (await client.get("/api/v1/notifications", headers=headers)).json()


@pytest.fixture
def push_enabled(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "vapid_public_key", "BPublicKeyForTests")
    monkeypatch.setattr(settings, "vapid_private_key", "private-key-for-tests")
    sent: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        push_service, "_send", lambda sub, payload: sent.append((sub["endpoint"], payload))
    )
    return sent


async def subscribe(client, headers, endpoint=None) -> str:
    endpoint = endpoint or f"https://push.example.com/{uuid.uuid4().hex}"
    response = await client.post(
        "/api/v1/push/subscriptions",
        json={"endpoint": endpoint, "keys": {"p256dh": "p" * 40, "auth": "a" * 16}},
        headers=headers,
    )
    assert response.status_code == 204, response.text
    return endpoint


async def no_quiet_hours(client, headers, **overrides) -> None:
    payload = {"quiet_hours": {"enabled": False, "start": "21:00", "end": "07:00"}, **overrides}
    assert (
        await client.put("/api/v1/me/notification-preferences", json=payload, headers=headers)
    ).status_code == 200


# ---------- Batching & dedupe ----------


async def test_reactions_are_batched_into_one_notification(client, fake_clock, push_enabled):
    at(fake_clock, "2027-07-07T10:00:00+07:00")
    author = await onboarded_user(client)
    await no_quiet_hours(client, author)
    await subscribe(client, author)
    fans = [await onboarded_user(client) for _ in range(3)]
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note()))["post"]
    for fan in fans:
        await client.put(f"/api/v1/posts/{post['id']}/reaction", json={"type": "like"}, headers=fan)

    box = await inbox(client, author)
    reactions = [n for n in box["items"] if n["type"] == "reaction"]
    assert len(reactions) == 1
    assert reactions[0]["actor_count"] == 3
    assert "dan 2 lainnya" in reactions[0]["title"]
    assert reactions[0]["url"] == f"/posts/{post['id']}"

    # Push baru dikirim setelah jendela batching 5 menit.
    db = db_module.get_db()
    await push_service.dispatch_due(db)
    assert not [p for _, p in push_enabled if "lainnya" in p["title"]]
    fake_clock.advance(minutes=6)
    await push_service.dispatch_due(db)
    batched = [p for _, p in push_enabled if "lainnya" in p["title"]]
    assert len(batched) == 1 and batched[0]["tag"] == f"reaction:{post['id']}"


async def test_comment_reply_and_mention_notify_each_person_once(client, fake_clock):
    author = await onboarded_user(client)
    commenter = await onboarded_user(client)
    replier = await onboarded_user(client)
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note()))["post"]
    author_me = await me(client, author)
    url = f"/api/v1/posts/{post['id']}/comments"

    # Komentar yang me-mention penulis → penulis hanya menerima "mention".
    root = (
        await client.post(
            url,
            json={
                "content": f"@{author_me['name']} catatanmu bagus",
                "mention_ids": [author_me["id"]],
            },
            headers=commenter,
        )
    ).json()["comment"]
    types = [n["type"] for n in (await inbox(client, author))["items"]]
    assert types.count("mention") == 1 and "comment" not in types

    # Balasan → penulis komentar menerima "reply", penulis posting menerima "comment".
    await client.post(
        url, json={"content": "Setuju sekali", "parent_id": root["id"]}, headers=replier
    )
    assert [n["type"] for n in (await inbox(client, commenter))["items"]][0] == "reply"
    assert "comment" in [n["type"] for n in (await inbox(client, author))["items"]]

    # Tidak ada notifikasi untuk diri sendiri.
    await client.post(url, json={"content": "Terima kasih semuanya!"}, headers=author)
    own = await db_module.get_db()["notifications"].count_documents(
        {"user_id": ObjectId(author_me["id"]), "actor_ids": ObjectId(author_me["id"])}
    )
    assert own == 0


# ---------- Preferensi & jam tenang ----------


async def test_disabled_type_creates_nothing(client, fake_clock):
    author, reader = await onboarded_user(client), await onboarded_user(client)
    await client.put(
        "/api/v1/me/notification-preferences",
        json={"types": {"comment": {"push": False, "in_app": False}}},
        headers=author,
    )
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note()))["post"]
    await client.post(
        f"/api/v1/posts/{post['id']}/comments", json={"content": "Halo!"}, headers=reader
    )
    assert [n for n in (await inbox(client, author))["items"] if n["type"] == "comment"] == []

    prefs = (await client.get("/api/v1/me/notification-preferences", headers=author)).json()
    assert prefs["types"]["comment"] == {"push": False, "in_app": False}
    assert prefs["types"]["reaction"] == {"push": True, "in_app": True}


async def test_preferences_validation(client):
    headers = await onboarded_user(client)
    bad_time = await client.put(
        "/api/v1/me/notification-preferences", json={"reminder_time": "25:99"}, headers=headers
    )
    assert bad_time.status_code == 422
    bad_type = await client.put(
        "/api/v1/me/notification-preferences",
        json={"types": {"spam": {"push": True, "in_app": True}}},
        headers=headers,
    )
    assert bad_type.status_code == 422


def test_quiet_hours_and_frequency_scheduling():
    prefs = notification_service._defaults()
    tz = "Asia/Jakarta"
    late = datetime(2027, 1, 4, 22, 30, tzinfo=UTC) - timedelta(hours=7)  # 22:30 WIB
    assert notification_service.deliver_after(late, prefs, tz).astimezone(UTC) == datetime(
        2027, 1, 5, 0, 0, tzinfo=UTC
    )  # 07:00 WIB
    noon = datetime(2027, 1, 4, 5, 10, tzinfo=UTC)  # 12:10 WIB
    assert notification_service.deliver_after(noon, prefs, tz) == noon
    prefs.frequency = "batched"
    assert notification_service.deliver_after(noon, prefs, tz) == datetime(
        2027, 1, 4, 6, 0, tzinfo=UTC
    )
    prefs.frequency = "daily_digest"
    assert notification_service.deliver_after(noon, prefs, tz) == datetime(
        2027, 1, 5, 1, 0, tzinfo=UTC
    )


# ---------- Inbox ----------


async def test_inbox_unread_and_mark_read(client, fake_clock):
    author, reader = await onboarded_user(client), await onboarded_user(client)
    book = await create_book(client, author)
    for _ in range(2):
        post = (await quick_post(client, author, book["id"], note()))["post"]
        await client.post(
            f"/api/v1/posts/{post['id']}/comments", json={"content": "Keren!"}, headers=reader
        )
    box = await inbox(client, author)
    assert box["unread_count"] >= 2
    first = box["items"][0]["id"]
    after_one = await client.post(
        "/api/v1/notifications/read", json={"ids": [first]}, headers=author
    )
    assert after_one.json()["unread_count"] == box["unread_count"] - 1
    after_all = await client.post("/api/v1/notifications/read", json={"all": True}, headers=author)
    assert after_all.json()["unread_count"] == 0
    count = (await client.get("/api/v1/notifications/unread-count", headers=author)).json()
    assert count == {"unread_count": 0}


# ---------- Push ----------


async def test_push_subscription_and_dispatch(client, fake_clock, push_enabled, monkeypatch):
    at(fake_clock, "2027-07-14T10:00:00+07:00")
    author, reader = await onboarded_user(client), await onboarded_user(client)
    await no_quiet_hours(client, author)
    good = await subscribe(client, author)
    dead = await subscribe(client, author)
    assert (await client.get("/api/v1/push/config", headers=author)).json()["enabled"] is True
    insecure = await client.post(
        "/api/v1/push/subscriptions",
        json={
            "endpoint": "http://evil.example.com/x",
            "keys": {"p256dh": "p" * 40, "auth": "a" * 16},
        },
        headers=author,
    )
    assert insecure.status_code == 422

    class Gone:
        status_code = 410

    def fake_send(sub, payload):
        if sub["endpoint"] == dead:
            raise WebPushException("gone", response=Gone())
        push_enabled.append((sub["endpoint"], payload))

    monkeypatch.setattr(push_service, "_send", fake_send)
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note()))["post"]
    await client.post(
        f"/api/v1/posts/{post['id']}/comments", json={"content": "Mantap"}, headers=reader
    )
    await push_service.dispatch_due(db_module.get_db())

    # Notifikasi badge "Langkah Pertama" juga terkirim; cek push komentar & langganan mati.
    pushed = {(e, p["url"]) for e, p in push_enabled}
    assert (good, f"/posts/{post['id']}") in pushed
    assert all(e == good for e, _ in pushed)
    author_id = ObjectId((await me(client, author))["id"])
    endpoints = await db_module.get_db()["push_subscriptions"].distinct(
        "endpoint", {"user_id": author_id}
    )
    assert endpoints == [good]  # langganan 410 dihapus

    await client.post("/api/v1/push/unsubscribe", json={"endpoint": good}, headers=author)
    assert (
        await db_module.get_db()["push_subscriptions"].count_documents({"user_id": author_id}) == 0
    )


async def test_batched_frequency_sends_single_summary(client, fake_clock, push_enabled):
    at(fake_clock, "2027-07-21T10:10:00+07:00")
    author, reader = await onboarded_user(client), await onboarded_user(client)
    await no_quiet_hours(client, author, frequency="batched")
    endpoint = await subscribe(client, author)
    book = await create_book(client, author)
    for _ in range(3):
        post = (await quick_post(client, author, book["id"], note()))["post"]
        await client.post(
            f"/api/v1/posts/{post['id']}/comments", json={"content": "Bagus"}, headers=reader
        )
    db = db_module.get_db()
    await push_service.dispatch_due(db)
    assert [p for e, p in push_enabled if e == endpoint] == []
    fake_clock.advance(minutes=55)  # 11:05 → lewat jam berikutnya
    await push_service.dispatch_due(db)
    mine = [p for e, p in push_enabled if e == endpoint]
    assert (
        len(mine) == 1
        and mine[0]["tag"] == "digest"
        and mine[0]["body"].startswith("4 notifikasi")  # 3 komentar + badge
    )


async def test_push_disabled_marks_skipped(client, fake_clock):
    author, reader = await onboarded_user(client), await onboarded_user(client)
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note()))["post"]
    await client.post(
        f"/api/v1/posts/{post['id']}/comments", json={"content": "Oke"}, headers=reader
    )
    fake_clock.advance(days=1)
    await push_service.dispatch_due(db_module.get_db())
    author_id = ObjectId((await me(client, author))["id"])
    doc = await db_module.get_db()["notifications"].find_one(
        {"user_id": author_id, "type": "comment"}
    )
    assert doc["push_status"] == "skipped"
    assert (await client.post("/api/v1/push/test", headers=author)).status_code == 503


# ---------- Job terjadwal ----------


async def test_reading_reminder_once_and_only_if_not_read(client, fake_clock):
    at(fake_clock, "2027-08-02T19:05:00+07:00")
    lazy, diligent = await onboarded_user(client), await onboarded_user(client)
    book = await create_book(client, diligent)
    at(fake_clock, "2027-08-02T09:00:00+07:00")
    await quick_post(client, diligent, book["id"], note())
    at(fake_clock, "2027-08-02T19:05:00+07:00")
    db = db_module.get_db()
    await notification_jobs.reading_reminders(db)
    await notification_jobs.reading_reminders(db)  # tidak ganda
    lazy_box = [n for n in (await inbox(client, lazy))["items"] if n["type"] == "reading_reminder"]
    assert len(lazy_box) == 1 and "15 menit" in lazy_box[0]["body"]
    assert [
        n for n in (await inbox(client, diligent))["items"] if n["type"] == "reading_reminder"
    ] == []


async def test_streak_at_risk_evening(client, fake_clock):
    at(fake_clock, "2027-08-09T08:00:00+07:00")
    reader = await onboarded_user(client)
    book = await create_book(client, reader)
    await quick_post(client, reader, book["id"], note())
    at(fake_clock, "2027-08-10T20:01:00+07:00")  # besoknya belum baca
    await notification_jobs.streak_at_risk(db_module.get_db())
    items = [n for n in (await inbox(client, reader))["items"] if n["type"] == "streak_at_risk"]
    assert len(items) == 1 and items[0]["title"].startswith("Streak 1 hari")


async def test_weekly_jobs_run_once(client, fake_clock):
    at(fake_clock, "2027-08-18T10:00:00+07:00")  # Rabu minggu sebelumnya
    reader = await onboarded_user(client)
    book = await create_book(client, reader)
    await quick_post(client, reader, book["id"], note())
    db = db_module.get_db()

    at(fake_clock, "2027-08-23T08:03:00+07:00")  # Senin 08:03
    assert await notification_jobs.new_quests(db) > 0
    assert await notification_jobs.new_quests(db) == 0
    at(fake_clock, "2027-08-23T09:02:00+07:00")  # Senin 09:02
    assert await notification_jobs.weekly_leaderboard(db) > 0
    assert await notification_jobs.weekly_leaderboard(db) == 0
    box = (await inbox(client, reader))["items"]
    weekly = next(n for n in box if n["type"] == "weekly_leaderboard")
    assert "#" in weekly["body"] and weekly["url"] == "/leaderboard?key=2027-W33"
    assert any(n["type"] == "new_quest" for n in box)

    at(fake_clock, "2027-08-24T09:02:00+07:00")  # Selasa: bukan jadwalnya
    assert await notification_jobs.weekly_leaderboard(db) == 0


async def test_scheduler_tick_and_lease(database, fake_clock):
    at(fake_clock, "2027-09-01T12:00:00+07:00")
    db = db_module.get_db()
    await database["job_locks"].delete_many({})
    assert await scheduler.acquire_lease(db) is True
    assert await scheduler.acquire_lease(db) is True  # pemilik sama
    await database["job_locks"].update_one({"_id": "scheduler"}, {"$set": {"owner": "lain"}})
    assert await scheduler.acquire_lease(db) is False
    fake_clock.advance(minutes=2)  # lease kedaluwarsa
    assert await scheduler.acquire_lease(db) is True
    results = await scheduler.tick(db)
    assert "reading_reminders" in results and "sent" in results
