import uuid
from datetime import UTC, datetime

import httpx
import pytest
from bson import ObjectId
from httpx_ws import aconnect_ws
from httpx_ws.transport import ASGIWebSocketTransport

from app.core import db as db_module
from app.main import app
from app.services import authenticity_service
from tests.conftest import (
    admin_headers,
    auth_header,
    create_book,
    me,
    onboarded_user,
    quick_post,
    register,
)


def note(seed: str | None = None) -> str:
    seed = seed or uuid.uuid4().hex
    return (
        f"Catatan {seed}: penulis menjelaskan bagaimana kebiasaan kecil yang konsisten membentuk "
        "identitas baru. Saya mencatat tiga ide yang ingin dicoba bersama tim minggu ini, mulai "
        "dari menaruh buku di meja kerja sampai membaca sebelum rapat pagi dimulai."
    )


def story(seed: str | None = None) -> str:
    return note(seed) + (
        " Bagian kedua bab ini membahas lingkungan yang mendukung: notifikasi dimatikan, rak buku "
        "di ruang tamu, dan teman yang saling mengingatkan. Saya tertarik mencoba sistem dua menit "
        "agar kebiasaan membaca terasa ringan, lalu pelan-pelan menambah durasinya setiap pekan. "
        "Penutup bab mengajak pembaca merayakan kemajuan sekecil apa pun bersama orang terdekat."
    )


def at(fake_clock, iso: str) -> None:
    fake_clock.current = datetime.fromisoformat(iso).astimezone(UTC)


async def _user_with_role(client, database, role_code: str, function_id: str | None = None):
    role = await database["roles"].find_one({"code": role_code})
    extra = {"function_id": function_id} if function_id else {}
    headers = auth_header(await register(client, **extra))
    user_id = ObjectId((await client.get("/api/v1/me", headers=headers)).json()["id"])
    await database["users"].update_one({"_id": user_id}, {"$set": {"role_id": role["_id"]}})
    return headers


# ---------- Authenticity Index ----------


def test_classify_thresholds():
    t = {"active_reader": 0.5, "warming_up": 0.25, "observer": 0.0}
    assert authenticity_service.classify(0, 0, 0, t) == (0.0, "silent")
    assert authenticity_service.classify(2, 1, 1, t)[1] == "active_reader"
    assert authenticity_service.classify(1, 1, 1, t)[1] == "warming_up"
    assert authenticity_service.classify(1, 2, 3, t)[1] == "observer"
    assert authenticity_service.classify(0, 0, 5, t)[1] == "observer"


async def test_authenticity_status_and_visibility(client, fake_clock, database):
    writer, lurker = await onboarded_user(client), await onboarded_user(client)
    book = await create_book(client, writer)
    post = (await quick_post(client, writer, book["id"], note()))["post"]
    await client.put(f"/api/v1/posts/{post['id']}/reaction", json={"type": "like"}, headers=lurker)

    mine = (await client.get("/api/v1/me/authenticity", headers=writer)).json()
    assert (mine["status"], mine["own_notes"], mine["contribution_ratio"]) == (
        "active_reader",
        1,
        1.0,
    )
    lurker_status = (await client.get("/api/v1/me/authenticity", headers=lurker)).json()
    assert lurker_status["status"] == "observer" and lurker_status["likes_given"] == 1

    # Member lain tidak boleh melihat status orang lain.
    lurker_id = (await me(client, lurker))["id"]
    denied = await client.get(f"/api/v1/authenticity/users/{lurker_id}", headers=writer)
    assert denied.status_code == 403
    assert (await client.get("/api/v1/authenticity/team", headers=writer)).status_code == 403

    # Admin melihat semua.
    admin = await admin_headers(client)
    seen = await client.get(f"/api/v1/authenticity/users/{lurker_id}", headers=admin)
    assert seen.json()["status"] == "observer"


async def test_team_lead_sees_only_led_function(client, fake_clock, database):
    code = f"tim-{uuid.uuid4().hex[:6]}"
    fn = await database["functions"].insert_one(
        {
            "name": "Tim Uji",
            "code": code,
            "parent_id": None,
            "ancestors": [],
            "lead_user_ids": [],
            "is_active": True,
            "sort_order": 50,
        }
    )
    fn_id = str(fn.inserted_id)
    lead = await _user_with_role(client, database, "team_lead", fn_id)
    member = await _user_with_role(client, database, "member", fn_id)
    outsider = await onboarded_user(client)  # fungsi lain

    member_id = (await me(client, member))["id"]
    outsider_id = (await me(client, outsider))["id"]
    assert (
        await client.get(f"/api/v1/authenticity/users/{member_id}", headers=lead)
    ).status_code == 200
    assert (
        await client.get(f"/api/v1/authenticity/users/{outsider_id}", headers=lead)
    ).status_code == 403

    team = (await client.get("/api/v1/authenticity/team", headers=lead)).json()
    assert {m["user_id"] for m in team["members"]} == {member_id, (await me(client, lead))["id"]}
    assert team["counts"]["silent"] == 2
    other_fn = (await me(client, outsider))["function_id"]
    forbidden = await client.get(
        "/api/v1/authenticity/team", params={"function_id": other_fn}, headers=lead
    )
    assert forbidden.status_code == 403


async def test_daily_job_snapshots_and_nudges_observers_once(client, fake_clock, database):
    writer, lurker = await onboarded_user(client), await onboarded_user(client)
    book = await create_book(client, writer)
    post = (await quick_post(client, writer, book["id"], note()))["post"]
    await client.put(
        f"/api/v1/posts/{post['id']}/reaction", json={"type": "inspiring"}, headers=lurker
    )
    lurker_id = ObjectId((await me(client, lurker))["id"])

    await authenticity_service.run_daily(db_module.get_db())
    nudges = await database["notifications"].count_documents(
        {"user_id": lurker_id, "type": "observer_nudge"}
    )
    assert nudges == 1
    snapshot = await database["authenticity_snapshots"].find_one({"user_id": lurker_id})
    assert snapshot["status"] == "observer" and snapshot["nudged_at"] is not None

    fake_clock.advance(days=2)
    await authenticity_service.run_daily(db_module.get_db())
    assert (
        await database["notifications"].count_documents(
            {"user_id": lurker_id, "type": "observer_nudge"}
        )
        == 1
    )  # jeda 7 hari
    fake_clock.advance(days=6)
    await authenticity_service.run_daily(db_module.get_db())
    assert (
        await database["notifications"].count_documents(
            {"user_id": lurker_id, "type": "observer_nudge"}
        )
        == 2
    )


# ---------- Badge ----------


async def test_first_session_badge_and_badge_list(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    result = await quick_post(client, headers, book["id"], note())
    assert [b["code"] for b in result["badges"]] == ["first-step"]

    badges = (await client.get("/api/v1/me/badges", headers=headers)).json()
    first = next(b for b in badges if b["code"] == "first-step")
    assert first["earned"] is True and first["awarded_at"]
    finisher = next(b for b in badges if b["code"] == "finisher-1")
    assert finisher["earned"] is False and finisher["target"] == 1

    again = await quick_post(client, headers, book["id"], note())
    assert again["badges"] == []


# ---------- Quest ----------


async def test_weekly_quest_reward_once_per_week(client, fake_clock, database):
    at(fake_clock, "2027-05-05T12:00:00+07:00")
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    result = await quick_post(client, headers, book["id"], story(), note_type="chapter_story")
    assert [q["code"] for q in result["quests_completed"]] == ["weekly-chapter-story"]
    assert {
        "rule_code": "quest_reward",
        "name": "Quest: Satu Chapter Story",
        "points": 25,
    } in result["points"]["awarded"]

    second = await quick_post(client, headers, book["id"], story(), note_type="chapter_story")
    assert second["quests_completed"] == []

    quests = (await client.get("/api/v1/quests", headers=headers)).json()
    chapter = next(q for q in quests if q["code"] == "weekly-chapter-story")
    assert chapter["completed"] is True and chapter["progress"] == 1
    days = next(q for q in quests if q["code"] == "weekly-3-days")
    assert (days["progress"], days["target"], days["completed"]) == (1, 3, False)

    user_id = ObjectId((await me(client, headers))["id"])
    assert (
        await database["points_ledger"].count_documents(
            {"user_id": user_id, "rule_code": "quest_reward"}
        )
        == 1
    )

    # Minggu berikutnya: quest yang sama bisa diselesaikan lagi.
    fake_clock.advance(days=7)
    fresh = (await client.get("/api/v1/quests", headers=headers)).json()
    assert next(q for q in fresh if q["code"] == "weekly-chapter-story")["completed"] is False
    third = await quick_post(client, headers, book["id"], story(), note_type="chapter_story")
    assert "weekly-chapter-story" in [q["code"] for q in third["quests_completed"]]


# ---------- Book of the Month ----------


async def test_book_of_the_month_auto_and_admin(client, fake_clock, database):
    at(fake_clock, "2027-06-10T12:00:00+07:00")
    headers = await onboarded_user(client)
    busy = await create_book(client, headers)
    quiet = await create_book(client, headers)
    for _ in range(2):
        await quick_post(client, headers, busy["id"], note())
    auto = (await client.get("/api/v1/book-of-the-month", headers=headers)).json()
    assert auto["auto"] is True and auto["book"]["id"] == busy["id"] and auto["month"] == "2027-06"
    assert auto["readers_this_month"] == 1

    assert (
        await client.put(f"/api/v1/book-of-the-month/{quiet['id']}", headers=headers)
    ).status_code == 403
    admin = await admin_headers(client)
    chosen = (await client.put(f"/api/v1/book-of-the-month/{quiet['id']}", headers=admin)).json()
    assert chosen["auto"] is False and chosen["book"]["id"] == quiet["id"]
    assert await database["audit_logs"].find_one({"action": "book_of_month.set"})


# ---------- Reading Buddy ----------


async def test_reading_buddy_flow(client, fake_clock, database):
    a, b, c = (
        await onboarded_user(client),
        await onboarded_user(client),
        await onboarded_user(client),
    )
    b_id, c_id = (await me(client, b))["id"], (await me(client, c))["id"]

    sent = await client.post("/api/v1/buddies", params={"user_id": b_id}, headers=a)
    assert sent.status_code == 201 and len(sent.json()["outgoing"]) == 1
    dup = await client.post("/api/v1/buddies", params={"user_id": b_id}, headers=a)
    assert dup.status_code == 409
    await client.post("/api/v1/buddies", params={"user_id": c_id}, headers=a)

    incoming = (await client.get("/api/v1/buddies", headers=b)).json()["incoming"]
    pair_id = incoming[0]["pair_id"]
    # Hanya penerima yang bisa menerima.
    assert (await client.post(f"/api/v1/buddies/{pair_id}/accept", headers=a)).status_code == 403
    accepted = (await client.post(f"/api/v1/buddies/{pair_id}/accept", headers=b)).json()
    assert accepted["buddy"]["user"]["id"] == (await me(client, a))["id"]
    assert accepted["buddy"]["read_today"] is False

    # Permintaan lain milik A otomatis dibatalkan.
    assert (await client.get("/api/v1/buddies", headers=c)).json()["incoming"] == []
    assert (
        await client.post("/api/v1/buddies", params={"user_id": c_id}, headers=a)
    ).status_code == 409

    assert (await client.post(f"/api/v1/buddies/{pair_id}/cheer", headers=b)).status_code == 204
    assert (await client.post(f"/api/v1/buddies/{pair_id}/cheer", headers=b)).status_code == 429
    a_id = ObjectId((await me(client, a))["id"])
    assert (
        await database["notifications"].count_documents({"user_id": a_id, "type": "buddy_cheer"})
        == 1
    )

    ended = (await client.delete(f"/api/v1/buddies/{pair_id}", headers=a)).json()
    assert ended["buddy"] is None


# ---------- Reading Room (WebSocket) ----------


def ws_client() -> httpx.AsyncClient:
    # Dibuat di dalam task tes (bukan fixture) agar cancel scope anyio tetap di task yang sama.
    return httpx.AsyncClient(transport=ASGIWebSocketTransport(app=app), base_url="http://test")


def _token(headers: dict[str, str]) -> str:
    return headers["Authorization"].removeprefix("Bearer ")


async def _join(ws, headers: dict[str, str]) -> None:
    await ws.send_json({"type": "auth", "token": _token(headers)})


async def _next(ws, kind: str, where=lambda message: True):
    while True:
        message = await ws.receive_json()
        if message["type"] == kind and where(message):
            return message


async def test_reading_room_presence_and_cheers(client):
    room = str(ObjectId())
    a, b = await onboarded_user(client), await onboarded_user(client)
    a_id = (await me(client, a))["id"]
    async with ws_client() as wc, aconnect_ws(f"/ws/rooms/{room}", wc) as ws_a:
        await _join(ws_a, a)
        first = await _next(ws_a, "presence")
        assert [m["user_id"] for m in first["members"]] == [a_id]
        async with aconnect_ws(f"/ws/rooms/{room}", wc) as ws_b:
            await _join(ws_b, b)
            both = await _next(ws_a, "presence", lambda m: len(m["members"]) == 2)
            assert len(both["members"]) == 2

            await ws_a.send_json(
                {
                    "type": "status",
                    "reading": True,
                    "book_title": "Laskar Pelangi",
                    "elapsed_seconds": 120,
                }
            )
            update = await _next(ws_b, "presence", lambda m: m["members"][0]["reading"])
            reader = next(m for m in update["members"] if m["user_id"] == a_id)
            assert reader["reading"] is True and reader["book_title"] == "Laskar Pelangi"
            assert update["members"][0]["user_id"] == a_id  # yang sedang membaca di atas

            await ws_b.send_json({"type": "cheer", "emoji": "👏", "to": a_id})
            cheer = await _next(ws_a, "cheer")
            assert cheer["emoji"] == "👏" and cheer["to"] == a_id

            await ws_b.send_json({"type": "cheer", "emoji": "💣"})  # emoji tidak diizinkan
            await ws_b.send_json({"type": "ping"})
            assert (await _next(ws_b, "pong"))["type"] == "pong"
        after = await _next(ws_a, "presence", lambda m: len(m["members"]) == 1)
        assert [m["user_id"] for m in after["members"]] == [a_id]


def _close_codes(exc: BaseException) -> list[int]:
    from httpx_ws import WebSocketDisconnect

    if isinstance(exc, WebSocketDisconnect):
        return [exc.code]
    if isinstance(exc, BaseExceptionGroup):
        return [c for e in exc.exceptions for c in _close_codes(e)]
    return []


@pytest.mark.parametrize(
    "first_message",
    [
        {"type": "auth", "token": "invalid"},
        {"type": "status", "reading": True},  # pesan pertama bukan auth
    ],
)
async def test_reading_room_rejects_bad_auth(first_message):
    async with ws_client() as wc:
        with pytest.raises(BaseException) as exc:  # noqa: B017 - dibungkus ExceptionGroup
            async with aconnect_ws("/ws/rooms/global", wc) as ws:
                await ws.send_json(first_message)
                await ws.receive_json()
    assert 4401 in _close_codes(exc.value)


async def test_reading_room_ignores_token_in_query(client):
    headers = await onboarded_user(client)
    async with ws_client() as wc:
        with pytest.raises(BaseException) as exc:  # noqa: B017 - dibungkus ExceptionGroup
            async with aconnect_ws(f"/ws/rooms/global?token={_token(headers)}", wc) as ws:
                await ws.send_json({"type": "ping"})
                await ws.receive_json()
    assert 4401 in _close_codes(exc.value)
