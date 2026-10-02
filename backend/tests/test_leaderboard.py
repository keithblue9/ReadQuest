import uuid
from datetime import UTC, datetime

from app.services.leaderboard_service import _rank, period_window
from tests.conftest import (
    auth_header,
    create_book,
    me,
    quick_post,
    register,
)


def note(seed: str) -> str:
    return (
        f"Catatan {seed}: penulis menjelaskan bagaimana kebiasaan kecil yang konsisten membentuk "
        "identitas baru. Saya mencatat tiga ide yang ingin dicoba bersama tim minggu ini, "
        "mulai dari menaruh buku di meja kerja sampai membaca sebelum rapat pagi dimulai."
    )


async def user_in(client, function_id: str | None = None) -> dict[str, str]:
    headers = auth_header(await register(client))
    options = (await client.get("/api/v1/me/onboarding/options", headers=headers)).json()
    await client.put(
        "/api/v1/me/onboarding",
        json={
            "function_id": function_id or options["functions"][0]["id"],
            "interests": [options["categories"][0]["id"]],
            "daily_target_minutes": 15,
            "timezone": "Asia/Jakarta",
        },
        headers=headers,
    )
    return headers


async def board(client, headers, **params):
    response = await client.get("/api/v1/leaderboard", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def at(fake_clock, iso: str) -> None:
    fake_clock.current = datetime.fromisoformat(iso).astimezone(UTC)


async def test_storyteller_and_finisher(client, fake_clock):
    at(fake_clock, "2027-03-03T12:00:00+07:00")  # Rabu, 2027-W09
    a, b = await user_in(client), await user_in(client)
    book = await create_book(client, a)
    await quick_post(client, a, book["id"], note(uuid.uuid4().hex))
    await quick_post(client, a, book["id"], note(uuid.uuid4().hex))
    await quick_post(client, b, book["id"], note(uuid.uuid4().hex), is_book_finished=True)
    a_id, b_id = (await me(client, a))["id"], (await me(client, b))["id"]

    story = await board(client, a, category="top_storyteller", period="weekly")
    assert story["period_key"] == "2027-W09"
    assert story["label"] == "1 Mar – 7 Mar 2027"
    assert [(e["rank"], e["user"]["id"], e["score"]) for e in story["entries"]] == [
        (1, a_id, 2),
        (2, b_id, 1),
    ]
    assert story["me"] == {"rank": 1, "score": 2, "total_participants": 2}

    finisher = await board(client, b, category="book_finisher", period="weekly")
    assert [(e["user"]["id"], e["score"]) for e in finisher["entries"]] == [(b_id, 1)]
    assert (await board(client, a, category="book_finisher", period="weekly"))["me"] is None

    all_time = await board(client, a, category="top_storyteller", period="all_time")
    assert all_time["period_key"] == "all"
    assert any(e["user"]["id"] == a_id for e in all_time["entries"]) or all_time["me"]


async def test_previous_week_is_frozen_and_selectable(client, fake_clock):
    at(fake_clock, "2027-03-10T12:00:00+07:00")  # 2027-W10
    a = await user_in(client)
    book = await create_book(client, a)
    await quick_post(client, a, book["id"], note(uuid.uuid4().hex))

    at(fake_clock, "2027-03-17T12:00:00+07:00")  # minggu berikutnya
    current = await board(client, a, category="top_storyteller", period="weekly")
    assert current["period_key"] == "2027-W11" and current["entries"] == []

    previous = await board(
        client, a, category="top_storyteller", period="weekly", period_key="2027-W10"
    )
    assert previous["is_final"] is True
    assert previous["me"]["score"] == 1
    assert (previous["prev_key"], previous["next_key"]) == ("2027-W09", "2027-W11")
    assert (current["prev_key"], current["next_key"]) == ("2027-W10", None)
    future = await client.get(
        "/api/v1/leaderboard",
        params={"category": "top_storyteller", "period": "weekly", "period_key": "2027-W30"},
        headers=a,
    )
    assert future.status_code == 422

    bad = await client.get(
        "/api/v1/leaderboard",
        params={"category": "top_storyteller", "period": "weekly", "period_key": "nope"},
        headers=a,
    )
    assert bad.status_code == 422


async def test_most_inspiring_counts_reactions_from_others(client, fake_clock):
    at(fake_clock, "2027-03-24T12:00:00+07:00")  # 2027-W12
    author, fan1, fan2 = await user_in(client), await user_in(client), await user_in(client)
    book = await create_book(client, author)
    post = (await quick_post(client, author, book["id"], note(uuid.uuid4().hex)))["post"]
    url = f"/api/v1/posts/{post['id']}/reaction"
    await client.put(url, json={"type": "inspiring"}, headers=fan1)
    await client.put(url, json={"type": "like"}, headers=fan2)
    await client.put(url, json={"type": "like"}, headers=author)  # tidak dihitung

    result = await board(client, author, category="most_inspiring", period="weekly")
    assert result["me"]["score"] == 2
    assert result["entries"][0]["detail"] == {"inspiring": 1}


async def test_streak_master_counts_reading_days(client, fake_clock):
    at(fake_clock, "2027-03-29T09:00:00+07:00")  # Senin 2027-W13
    reader = await user_in(client)
    book = await create_book(client, reader)
    for day in range(3):
        await quick_post(client, reader, book["id"], note(f"hari-{day}-{uuid.uuid4().hex}"))
        fake_clock.advance(days=1)
    weekly = await board(client, reader, category="streak_master", period="weekly")
    assert weekly["me"]["score"] == 3
    assert weekly["entries"][0]["detail"]["minutes"] == 45

    all_time = await board(client, reader, category="streak_master", period="all_time")
    assert all_time["me"]["score"] >= 3


async def test_function_battle_is_normalized_per_member(client, fake_clock, database):
    at(fake_clock, "2027-04-07T12:00:00+07:00")  # 2027-W14
    codes = [f"uji-{uuid.uuid4().hex[:6]}" for _ in range(2)]
    ids = []
    for code in codes:
        result = await database["functions"].insert_one(
            {
                "name": f"Fungsi {code}",
                "code": code,
                "parent_id": None,
                "ancestors": [],
                "lead_user_ids": [],
                "is_active": True,
                "sort_order": 99,
            }
        )
        ids.append(str(result.inserted_id))
    big1, big2 = await user_in(client, ids[0]), await user_in(client, ids[0])
    small = await user_in(client, ids[1])
    book = await create_book(client, big1)
    # Fungsi besar: 2 anggota x 30 poin = 60 → rata-rata 30.
    await quick_post(client, big1, book["id"], note(uuid.uuid4().hex))
    await quick_post(client, big2, book["id"], note(uuid.uuid4().hex))
    # Fungsi kecil: 1 anggota, 30 + 10 = 40 → rata-rata 40.
    await quick_post(client, small, book["id"], note(uuid.uuid4().hex))
    await quick_post(client, small, book["id"], note(uuid.uuid4().hex))

    battle = await board(client, small, category="function_battle", period="weekly")
    ours = [e for e in battle["entries"] if e["function"]["id"] in ids]
    assert [(e["function"]["id"], e["score"], e["detail"]) for e in ours] == [
        (ids[1], 40.0, {"total_points": 40, "members": 1}),
        (ids[0], 30.0, {"total_points": 60, "members": 2}),
    ]
    assert battle["me"]["score"] == 40.0

    summary = (
        await client.get("/api/v1/leaderboard/me", params={"period": "weekly"}, headers=small)
    ).json()
    by_category = {s["category"]: s for s in summary}
    assert by_category["top_storyteller"]["score"] == 2
    assert by_category["function_battle"]["score"] == 40.0


async def test_cache_reused_and_invalidated_on_new_activity(client, fake_clock, database):
    at(fake_clock, "2027-04-14T12:00:00+07:00")  # 2027-W15
    a = await user_in(client)
    book = await create_book(client, a)
    first = await board(client, a, category="top_storyteller", period="weekly")
    assert first["me"] is None
    again = await board(client, a, category="top_storyteller", period="weekly")
    assert again["computed_at"] == first["computed_at"]  # dari cache

    # Aktivitas baru membuang cache periode berjalan → langsung terlihat.
    await quick_post(client, a, book["id"], note(uuid.uuid4().hex))
    fresh = await board(client, a, category="top_storyteller", period="weekly")
    assert fresh["me"]["score"] == 1

    # Snapshot periode final tidak ikut dibuang.
    final = await database["leaderboard_snapshots"].count_documents({"is_final": True})
    await quick_post(client, a, book["id"], note(uuid.uuid4().hex))
    assert await database["leaderboard_snapshots"].count_documents({"is_final": True}) == final


def test_competition_ranking_handles_ties():
    rows = [
        {"id": "a", "score": 5, "tiebreak": 1, "detail": {}},
        {"id": "b", "score": 5, "tiebreak": 1, "detail": {}},
        {"id": "c", "score": 3, "tiebreak": 9, "detail": {}},
        {"id": "d", "score": 0, "tiebreak": 0, "detail": {}},
    ]
    assert [(r["id"], r["rank"]) for r in _rank(rows)] == [("a", 1), ("b", 1), ("c", 3)]


def test_period_window_uses_team_timezone():
    # Senin 01:00 WIB = Minggu 18:00 UTC → sudah minggu baru di Jakarta.
    now = datetime(2026, 10, 4, 18, 0, tzinfo=UTC)
    week = period_window("weekly", "Asia/Jakarta", None, now)
    assert week.key == "2026-W41" and week.start_date == "2026-10-05"
    month = period_window("monthly", "Asia/Jakarta", "2026-12", now)
    assert (month.start_date, month.end_date, month.label) == (
        "2026-12-01",
        "2027-01-01",
        "Des 2026",
    )
