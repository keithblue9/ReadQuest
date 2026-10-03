import uuid

from tests.conftest import create_book, onboarded_user, quick_post


def note(seed: str) -> str:
    return (
        f"Catatan {seed}: bab ini membahas cara membangun kebiasaan membaca bersama tim. "
        "Saya mencatat tiga ide praktis yang ingin dicoba minggu ini, mulai dari menaruh buku "
        "di meja kerja sampai membaca lima belas menit sebelum rapat pagi dimulai."
    )


async def test_dashboard_requires_login(client):
    assert (await client.get("/api/v1/dashboard")).status_code == 401


async def test_dashboard_team_and_personal_stats(client):
    reader = await onboarded_user(client)
    idle = await onboarded_user(client)
    book = await create_book(client, reader, title=f"Dashboard {uuid.uuid4().hex[:6]}")
    await quick_post(client, reader, book["id"], note(uuid.uuid4().hex))
    await quick_post(client, reader, book["id"], note(uuid.uuid4().hex))

    body = (await client.get("/api/v1/dashboard", headers=reader)).json()
    team = body["team"]
    assert team["members"] >= 2
    assert team["readers_week"] >= 1 and team["minutes_week"] >= 30
    assert 0 < team["participation_week"] <= 1
    assert team["notes_week"] >= 2
    assert len(body["daily"]) == 14 and body["daily"][-1]["date"] == body["today"]
    assert body["daily"][-1]["minutes"] >= 30

    me = body["me"]
    assert me["minutes_week"] == 30 and me["rank_week"] >= 1
    assert len(me["daily"]) == 7 and me["daily"][-1]["minutes"] == 30
    assert any(b["book_id"] == book["id"] for b in body["popular_books"])
    assert body["recent_posts"] and {"author", "type", "created_at"} <= set(body["recent_posts"][0])
    assert all(0 <= f["rate"] <= 1 for f in body["by_function"])
    # Status Authenticity Index individu tetap privat.
    assert "authenticity" not in str(body).lower()

    other = (await client.get("/api/v1/dashboard", headers=idle)).json()
    assert other["me"]["rank_week"] is None and other["me"]["minutes_week"] == 0
