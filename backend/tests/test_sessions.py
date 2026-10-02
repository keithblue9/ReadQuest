import pytest

from tests.conftest import create_book, onboarded_user, read_for, upload_photo

QUICK_NOTE = (
    "Bab ini menjelaskan cara membangun kebiasaan membaca dengan target kecil setiap hari. "
    "Penulis menyarankan menaruh buku di tempat yang mudah terlihat dan mencatat satu ide "
    "penting setelah membaca. Besok saya mau mencoba membaca di kereta saat berangkat kerja. "
    "#kebiasaan"
)


def _story(seed: str) -> str:
    """Catatan unik ±90 kata agar lolos minimal Chapter Story & tidak terdeteksi duplikat."""
    return (
        f"Catatan {seed}. Tokoh utama akhirnya memutuskan meninggalkan desa pesisir untuk "
        "belajar di kota besar. Perjalanan itu penuh keraguan karena ibunya sakit dan kapal "
        "nelayan keluarga perlu diperbaiki. Saya tersentuh oleh dialog antara ayah dan anak di "
        "dermaga ketika matahari terbenam. Penulis menggambarkan suara ombak, bau garam, dan "
        "lampu perahu dengan sangat hidup. Bagian ini mengingatkan saya pada keputusan pindah "
        "kerja beberapa tahun lalu. Ada rasa bersalah, harapan, dan keberanian yang bercampur. "
        "Saya penasaran apakah dia akan kembali setelah lulus atau justru membangun hidup baru "
        "bersama teman-teman barunya di asrama mahasiswa."
    )


async def _start(client, headers, book_id):
    response = await client.post("/api/v1/sessions", json={"book_id": book_id}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _finish(client, headers, session_id, **overrides):
    payload = {
        "note_type": "quick_note",
        "content": QUICK_NOTE,
        "image_keys": [(await upload_photo(client, headers))["key"]],
        **overrides,
    }
    return await client.post(f"/api/v1/sessions/{session_id}/finish", json=payload, headers=headers)


async def test_heartbeat_credits_only_active_time(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    session = await _start(client, headers, book["id"])
    url = f"/api/v1/sessions/{session['id']}/heartbeat"

    fake_clock.advance(seconds=10)
    body = (await client.post(url, json={"state": "active"}, headers=headers)).json()
    assert body["active_seconds"] == 10

    # Celah panjang (layar mati) dibatasi max gap 45 detik.
    fake_clock.advance(seconds=600)
    body = (await client.post(url, json={"state": "paused"}, headers=headers)).json()
    assert body["active_seconds"] == 55
    assert body["status"] == "paused"

    # Selama pause tidak ada waktu yang dihitung.
    fake_clock.advance(seconds=30)
    body = (await client.post(url, json={"state": "active"}, headers=headers)).json()
    assert body["active_seconds"] == 55


async def test_only_one_open_session(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    await _start(client, headers, book["id"])
    second = await client.post("/api/v1/sessions", json={"book_id": book["id"]}, headers=headers)
    assert second.status_code == 409

    today = (await client.get("/api/v1/sessions/today", headers=headers)).json()
    assert today["active_session"]["book"]["title"] == book["title"]
    assert today["full_points_done"] is False


async def test_stale_session_is_abandoned(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    await _start(client, headers, book["id"])
    fake_clock.advance(hours=7)
    assert (
        await client.post("/api/v1/sessions", json={"book_id": book["id"]}, headers=headers)
    ).status_code == 201


async def test_finish_requires_minimum_time(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    session = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, session["id"], minutes=5)

    response = await _finish(client, headers, session["id"])
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "session_too_short"
    assert body["active_seconds"] == 300

    # Waktu yang terkumpul tetap tersimpan; lanjut membaca lalu selesai.
    await read_for(client, headers, fake_clock, session["id"], minutes=10)
    assert (await _finish(client, headers, session["id"])).status_code == 200


async def test_finish_creates_post_and_updates_stats(client, fake_clock, database):
    headers = await onboarded_user(client)
    book = await create_book(client, headers, total_pages=None)
    session = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, session["id"], minutes=15)

    response = await _finish(
        client, headers, session["id"], rating=5, current_page=40, total_pages=200
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["session"]["status"] == "completed"
    assert body["session"]["is_full_points"] is True
    assert body["session"]["local_date"] == "2026-10-05"
    post = body["post"]
    assert post["type"] == "quick_note"
    assert post["book"]["title"] == book["title"]
    assert post["image_urls"][0].startswith("/api/v1/media/photos/")
    assert post["page_progress"] == {"current_page": 40, "total_pages": 200}
    assert "fiksi" in post["topics"] and "kebiasaan" in post["topics"]

    updated = (await client.get(f"/api/v1/books/{book['id']}", headers=headers)).json()
    assert updated["stats"]["posts_count"] == 1
    assert updated["stats"]["readers_count"] == 1
    assert updated["stats"]["avg_rating"] == 5
    assert updated["total_pages"] == 200
    assert updated["cover_url"]

    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["stats"]["posts_count"] == 1

    page = (await client.get(f"/api/v1/books/{book['id']}/posts", headers=headers)).json()
    assert [p["id"] for p in page["items"]] == [post["id"]]


async def test_full_points_once_per_local_day(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)

    first = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, first["id"], minutes=15)
    assert (
        await _finish(client, headers, first["id"], note_type="chapter_story", content=_story("a"))
    ).json()["session"]["is_full_points"] is True

    second = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, second["id"], minutes=15)
    body = (
        await _finish(client, headers, second["id"], note_type="chapter_story", content=_story("b"))
    ).json()
    assert body["session"]["is_full_points"] is False
    today = (await client.get("/api/v1/sessions/today", headers=headers)).json()
    assert today["full_points_done"] is True

    # Hari berikutnya (zona waktu user) dapat poin penuh lagi.
    fake_clock.advance(days=1)
    third = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, third["id"], minutes=15)
    body = (
        await _finish(client, headers, third["id"], note_type="chapter_story", content=_story("c"))
    ).json()
    assert body["session"]["is_full_points"] is True

    stats = (await client.get(f"/api/v1/books/{book['id']}", headers=headers)).json()["stats"]
    assert stats["readers_count"] == 1
    assert stats["posts_count"] == 3


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"content": "Bagus sekali bukunya."}, "too_short"),
        ({"content": "baca " * 40}, "low_unique"),
        ({"pasted_chars": 10_000}, "too_much_paste"),
        ({"note_type": "chapter_story"}, "too_short"),
    ],
)
async def test_note_rejections(client, fake_clock, overrides, reason):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    session = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, session["id"], minutes=15)
    response = await _finish(client, headers, session["id"], **overrides)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "note_rejected"
    assert reason in error["reasons"]


async def test_duplicate_note_rejected(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    first = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, first["id"], minutes=15)
    assert (await _finish(client, headers, first["id"])).status_code == 200

    second = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, second["id"], minutes=15)
    response = await _finish(client, headers, second["id"], content=QUICK_NOTE.upper())
    assert response.status_code == 422
    assert response.json()["error"]["reasons"] == ["duplicate"]


async def test_finish_requires_own_photo(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    session = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, session["id"], minutes=15)

    no_photo = await client.post(
        f"/api/v1/sessions/{session['id']}/finish",
        json={"note_type": "quick_note", "content": QUICK_NOTE, "image_keys": []},
        headers=headers,
    )
    assert no_photo.status_code == 422

    foreign = await client.post(
        f"/api/v1/sessions/{session['id']}/finish",
        json={
            "note_type": "quick_note",
            "content": QUICK_NOTE,
            "image_keys": ["photos/000000000000000000000000/202610/x.jpg"],
        },
        headers=headers,
    )
    assert foreign.status_code == 422
    assert foreign.json()["error"]["code"] == "invalid_image"


async def test_book_finished_only_once(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    first = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, first["id"], minutes=15)
    ok = await _finish(client, headers, first["id"], is_book_finished=True)
    assert ok.json()["post"]["is_book_finished"] is True

    second = await _start(client, headers, book["id"])
    await read_for(client, headers, fake_clock, second["id"], minutes=15)
    again = await _finish(
        client, headers, second["id"], is_book_finished=True, content=_story("selesai")
    )
    assert again.status_code == 422
    assert again.json()["error"]["code"] == "book_already_finished"

    me = (await client.get("/api/v1/me", headers=headers)).json()
    assert me["stats"]["books_finished"] == 1


async def test_cannot_touch_other_users_session(client, fake_clock):
    owner = await onboarded_user(client)
    book = await create_book(client, owner)
    session = await _start(client, owner, book["id"])
    other = await onboarded_user(client)
    response = await client.post(
        f"/api/v1/sessions/{session['id']}/heartbeat", json={"state": "active"}, headers=other
    )
    assert response.status_code == 404


async def test_abandon_session(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    session = await _start(client, headers, book["id"])
    response = await client.post(f"/api/v1/sessions/{session['id']}/abandon", headers=headers)
    assert response.status_code == 204
    today = (await client.get("/api/v1/sessions/today", headers=headers)).json()
    assert today["active_session"] is None
    again = await client.post(f"/api/v1/sessions/{session['id']}/abandon", headers=headers)
    assert again.status_code == 409


async def test_book_posts_pagination(client, fake_clock):
    headers = await onboarded_user(client)
    book = await create_book(client, headers)
    for i in range(3):
        session = await _start(client, headers, book["id"])
        await read_for(client, headers, fake_clock, session["id"], minutes=15)
        await _finish(
            client, headers, session["id"], note_type="chapter_story", content=_story(str(i))
        )

    first = (
        await client.get(f"/api/v1/books/{book['id']}/posts", params={"limit": 2}, headers=headers)
    ).json()
    assert len(first["items"]) == 2 and first["next_cursor"]
    second = (
        await client.get(
            f"/api/v1/books/{book['id']}/posts",
            params={"limit": 2, "cursor": first["next_cursor"]},
            headers=headers,
        )
    ).json()
    assert len(second["items"]) == 1 and second["next_cursor"] is None
    ids = [p["id"] for p in first["items"] + second["items"]]
    assert len(set(ids)) == 3


async def test_session_config(client):
    headers = await onboarded_user(client)
    cfg = (await client.get("/api/v1/sessions/config", headers=headers)).json()
    assert cfg["min_seconds"] == 900
    assert cfg["note_min_words"] == {"quick_note": 30, "chapter_story": 80, "book_review": 200}
