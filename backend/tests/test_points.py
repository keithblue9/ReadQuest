import pytest
from bson import ObjectId

from app.core import db as db_module
from app.services import points_service
from tests.conftest import create_book, onboarded_user, quick_post
from tests.test_sessions import QUICK_NOTE, _story


@pytest.fixture(autouse=True)
async def _without_quests(database):
    """Tes aturan poin dasar tanpa hadiah quest (quest diuji di test_gamification)."""
    await database["quests"].update_many({}, {"$set": {"is_active": False}})
    yield
    await database["quests"].update_many({}, {"$set": {"is_active": True}})


async def _session(client, headers, fake_clock, book_id, **finish):
    content = finish.pop("content", QUICK_NOTE)
    return await quick_post(client, headers, book_id, content, **finish)


def _codes(result) -> dict[str, int]:
    return {a["rule_code"]: a["points"] for a in result["points"]["awarded"]}


async def test_first_session_awards_session_and_post_points(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    result = await _session(client, headers, fake_clock, book["id"])
    assert _codes(result) == {"session_valid": 20, "post_feed": 10}
    points = result["points"]
    assert points["total_awarded"] == 30
    assert points["points_total"] == 30
    assert points["streak"]["current"] == 1
    assert points["level"]["title"] == "Pembaca Pemula"

    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["stats"]["points_total"] == 30
    assert me["stats"]["current_streak"] == 1
    assert me["level"]["next_min_points"] == 200


async def test_chapter_story_progress_photo_and_book_finished(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    result = await _session(
        client,
        headers,
        fake_clock,
        book["id"],
        note_type="chapter_story",
        content=_story("bonus"),
        current_page=120,
        total_pages=120,
        is_book_finished=True,
    )
    assert _codes(result) == {
        "session_valid": 20,
        "chapter_story": 40,
        "post_feed": 10,
        "book_finished": 150,
        "progress_photo": 5,
    }
    assert result["points"]["points_total"] == 225
    assert result["points"]["level_up"] is True
    assert result["points"]["level"]["title"] == "Page Turner"


async def test_second_session_same_day_only_post_points_and_daily_caps(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    await _session(client, headers, fake_clock, book["id"], current_page=10)

    second = await _session(
        client,
        headers,
        fake_clock,
        book["id"],
        content=_story("dua"),
        note_type="chapter_story",
        current_page=20,
    )
    # Bukan sesi poin penuh: tanpa session_valid/chapter_story; foto progres maks 1x/hari.
    assert _codes(second) == {"post_feed": 10}

    third = await _session(
        client, headers, fake_clock, book["id"], content=_story("tiga"), note_type="chapter_story"
    )
    assert _codes(third) == {"post_feed": 10}
    # post_feed dibatasi 3x/hari.
    fourth = await _session(
        client, headers, fake_clock, book["id"], content=_story("empat"), note_type="chapter_story"
    )
    assert _codes(fourth) == {}

    summary = (await client.get("/api/v1/me/points", headers=headers)).json()
    assert summary["points_today"] == 20 + 10 + 5 + 10 + 10
    assert summary["points_total"] == summary["points_today"]


async def test_streak_grows_daily_resets_and_awards_milestone(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    result = None
    for day in range(7):
        result = await _session(
            client,
            headers,
            fake_clock,
            book["id"],
            content=_story(f"hari-{day}"),
            note_type="chapter_story",
        )
        fake_clock.advance(days=1)
    assert result["points"]["streak"] == {"current": 7, "longest": 7, "milestone": 7}
    assert _codes(result)["streak_7"] == 50

    # Hari ini belum baca → streak tetap hidup (terakhir kemarin).
    summary = (await client.get("/api/v1/me/points", headers=headers)).json()
    assert summary["streak"]["current"] == 7
    assert summary["streak"]["read_today"] is False
    assert summary["streak"]["next_milestone"] == 14

    # Lewat satu hari → streak dijaga oleh freeze (jatah 2/bulan), lalu berlanjut saat membaca.
    fake_clock.advance(days=1)
    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["stats"]["current_streak"] == 7
    frozen = (await client.get("/api/v1/me/points", headers=headers)).json()["streak"]
    assert frozen["freezes_per_month"] == 2
    assert frozen["freezes_left"] in (1, 2)  # 2 bila hari beku jatuh di bulan sebelumnya
    resumed = await _session(
        client, headers, fake_clock, book["id"], content=_story("lanjut"), note_type="chapter_story"
    )
    assert resumed["points"]["streak"] == {"current": 8, "longest": 8, "milestone": None}

    # Enam hari terlewat melebihi jatah freeze bulan mana pun → streak putus, mulai dari 1.
    fake_clock.advance(days=7)
    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["stats"]["current_streak"] == 0
    restarted = await _session(
        client, headers, fake_clock, book["id"], content=_story("baru"), note_type="chapter_story"
    )
    assert restarted["points"]["streak"] == {"current": 1, "longest": 8, "milestone": None}


async def test_ledger_is_idempotent_and_reconcilable(client, fake_clock, database):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    await _session(client, headers, fake_clock, book["id"])
    me = (await client.get("/api/v1/me", headers=headers)).json()
    user = await database["users"].find_one({"_id": ObjectId(me["id"])})
    session_entry = await database["points_ledger"].find_one(
        {"user_id": user["_id"], "rule_code": "session_valid"}
    )

    again = await points_service.award(
        db_module.get_db(),
        user=user,
        rule_code="session_valid",
        source_type="reading_session",
        source_id=session_entry["source_id"],
        local_date="2099-01-01",
    )
    assert again is None

    # Cache saldo dirusak → bisa dihitung ulang dari ledger.
    await database["users"].update_one({"_id": user["_id"]}, {"$set": {"stats.points_total": 999}})
    assert await points_service.recompute_total(database, user["_id"]) == 30


async def test_inactive_rule_and_admin_adjustment(client, fake_clock, database):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    await database["point_rules"].update_one({"code": "post_feed"}, {"$set": {"is_active": False}})
    try:
        result = await _session(client, headers, fake_clock, book["id"])
        assert _codes(result) == {"session_valid": 20}
    finally:
        await database["point_rules"].update_one(
            {"code": "post_feed"}, {"$set": {"is_active": True}}
        )

    me = (await client.get("/api/v1/me", headers=headers)).json()
    user = await database["users"].find_one({"_id": ObjectId(me["id"])})
    await points_service.adjust(
        database, user=user, points=-5, note="Koreksi uji", actor_id=user["_id"]
    )
    history = (await client.get("/api/v1/me/points/history", headers=headers)).json()
    assert history["items"][0]["rule_code"] == "adjustment"
    assert history["items"][0]["points"] == -5
    assert history["items"][0]["name"] == "Penyesuaian admin"
    assert (await client.get("/api/v1/me/points", headers=headers)).json()["points_total"] == 15


async def test_points_history_pagination(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    await _session(client, headers, fake_clock, book["id"], current_page=5)
    first = (
        await client.get("/api/v1/me/points/history", params={"limit": 2}, headers=headers)
    ).json()
    assert len(first["items"]) == 2 and first["next_cursor"]
    rest = (
        await client.get(
            "/api/v1/me/points/history",
            params={"limit": 2, "cursor": first["next_cursor"]},
            headers=headers,
        )
    ).json()
    assert len(rest["items"]) == 1
    codes = {i["rule_code"] for i in first["items"] + rest["items"]}
    assert codes == {"session_valid", "post_feed", "progress_photo"}
