import io
import uuid

from PIL import Image

from tests.conftest import admin_headers, create_book, me, onboarded_user, quick_post


def note(seed: str | None = None) -> str:
    seed = seed or uuid.uuid4().hex[:8]
    return (
        f"Catatan {seed}: bab ini membahas cara tim kecil membangun kebiasaan belajar bersama. "
        "Penulis menceritakan eksperimen membaca lima belas menit setiap pagi sebelum rapat dan "
        "dampaknya pada kualitas diskusi. Saya ingin mencoba format ini di tim kami minggu depan. "
        "#belajar"
    )


MEANINGFUL = "Setuju banget, kebiasaan membaca pagi juga membantu saya fokus sebelum rapat."


async def _setup(client):
    author = await onboarded_user(client)
    reader = await onboarded_user(client)
    book = await create_book(client, author)
    result = await quick_post(client, author, book["id"], note())
    return author, reader, book, result["post"]


async def test_reactions_counts_and_like_points(client, fake_clock):
    author, reader, _, post = await _setup(client)
    before = (await me(client, author))["stats"]["points_total"]
    url = f"/api/v1/posts/{post['id']}/reaction"

    liked = await client.put(url, json={"type": "like"}, headers=reader)
    assert liked.status_code == 200
    assert liked.json() == {"reaction": "like", "counts": {**post["counts"], "like": 1}}
    assert (await me(client, author))["stats"]["points_total"] == before + 2

    changed = (await client.put(url, json={"type": "insightful"}, headers=reader)).json()
    assert changed["counts"]["like"] == 0 and changed["counts"]["insightful"] == 1

    removed = (await client.delete(url, headers=reader)).json()
    assert removed["reaction"] is None and removed["counts"]["insightful"] == 0

    # Like ulang tidak memberi poin lagi (idempoten).
    await client.put(url, json={"type": "like"}, headers=reader)
    assert (await me(client, author))["stats"]["points_total"] == before + 2

    # Reaksi ke posting sendiri tidak memberi poin.
    await client.put(url, json={"type": "inspiring"}, headers=author)
    assert (await me(client, author))["stats"]["points_total"] == before + 2

    detail = (await client.get(f"/api/v1/posts/{post['id']}", headers=reader)).json()
    assert detail["viewer"]["reaction"] == "like"
    assert detail["counts"]["like"] == 1 and detail["counts"]["inspiring"] == 1

    bad = await client.put(url, json={"type": "angry"}, headers=reader)
    assert bad.status_code == 422


async def test_bookmarks_and_bookmarked_feed(client, fake_clock):
    _, reader, _, post = await _setup(client)
    url = f"/api/v1/posts/{post['id']}/bookmark"
    assert (await client.put(url, headers=reader)).json() == {"bookmarked": True, "bookmarks": 1}
    assert (await client.put(url, headers=reader)).json()["bookmarks"] == 1

    saved = (await client.get("/api/v1/feed", params={"bookmarked": True}, headers=reader)).json()
    assert [p["id"] for p in saved["items"]] == [post["id"]]
    assert saved["items"][0]["viewer"]["bookmarked"] is True

    assert (await client.delete(url, headers=reader)).json() == {
        "bookmarked": False,
        "bookmarks": 0,
    }
    empty = (await client.get("/api/v1/feed", params={"bookmarked": True}, headers=reader)).json()
    assert empty["items"] == []


async def test_meaningful_comment_points_and_threading(client, fake_clock):
    author, reader, _, post = await _setup(client)
    author_before = (await me(client, author))["stats"]["points_total"]
    reader_before = (await me(client, reader))["stats"]["points_total"]
    url = f"/api/v1/posts/{post['id']}/comments"

    created = await client.post(url, json={"content": MEANINGFUL}, headers=reader)
    assert created.status_code == 201
    body = created.json()
    assert body["comment"]["is_meaningful"] is True
    assert body["points"] == [
        {"rule_code": "meaningful_comment_given", "name": "Memberi komentar bermakna", "points": 3}
    ]
    assert (await me(client, author))["stats"]["points_total"] == author_before + 5
    assert (await me(client, reader))["stats"]["points_total"] == reader_before + 3

    short = (await client.post(url, json={"content": "Mantap!"}, headers=reader)).json()
    assert short["comment"]["is_meaningful"] is False and short["points"] == []

    duplicate = (await client.post(url, json={"content": MEANINGFUL}, headers=reader)).json()
    assert duplicate["comment"]["is_meaningful"] is False

    root_id = body["comment"]["id"]
    reply = (
        await client.post(
            url,
            json={"content": "Terima kasih sudah mampir membaca catatanku!", "parent_id": root_id},
            headers=author,
        )
    ).json()["comment"]
    assert reply["parent_id"] == root_id and reply["root_id"] == root_id
    nested = (
        await client.post(
            url, json={"content": "Sama-sama", "parent_id": reply["id"]}, headers=reader
        )
    ).json()["comment"]
    assert nested["root_id"] == root_id

    comments = (await client.get(url, headers=reader)).json()
    assert len(comments) == 5
    detail = (await client.get(f"/api/v1/posts/{post['id']}", headers=reader)).json()
    assert detail["counts"]["comments"] == 5


async def test_comment_parent_must_belong_to_post(client, fake_clock):
    author, reader, book, post = await _setup(client)
    other = (await quick_post(client, author, book["id"], note()))["post"]
    parent = (
        await client.post(
            f"/api/v1/posts/{other['id']}/comments",
            json={"content": "Komentar lain"},
            headers=reader,
        )
    ).json()["comment"]
    response = await client.post(
        f"/api/v1/posts/{post['id']}/comments",
        json={"content": "Balasan nyasar", "parent_id": parent["id"]},
        headers=reader,
    )
    assert response.status_code == 422


async def test_delete_comment_permissions(client, fake_clock):
    author, reader, _, post = await _setup(client)
    url = f"/api/v1/posts/{post['id']}/comments"
    root = (await client.post(url, json={"content": "Komentar pertama"}, headers=reader)).json()
    await client.post(
        url, json={"content": "Balasan", "parent_id": root["comment"]["id"]}, headers=author
    )
    lonely = (await client.post(url, json={"content": "Komentar kedua"}, headers=reader)).json()

    forbidden = await client.delete(f"{url}/{root['comment']['id']}", headers=author)
    assert forbidden.status_code == 403

    assert (
        await client.delete(f"{url}/{root['comment']['id']}", headers=reader)
    ).status_code == 204
    admin = await admin_headers(client)
    assert (
        await client.delete(f"{url}/{lonely['comment']['id']}", headers=admin)
    ).status_code == 204

    comments = (await client.get(url, headers=reader)).json()
    # Komentar terhapus yang masih punya balasan tetap tampil sebagai placeholder.
    assert [(c["deleted"], c["content"]) for c in comments] == [(True, ""), (False, "Balasan")]


async def test_mentions(client, fake_clock):
    author, reader, book, post = await _setup(client)
    unique_name = f"Rani {uuid.uuid4().hex[:6]}"
    await client.patch("/api/v1/me", json={"name": unique_name}, headers=reader)
    reader_me = await me(client, reader)
    created = await client.post(
        f"/api/v1/posts/{post['id']}/comments",
        json={"content": f"@{reader_me['name']} coba baca ini", "mention_ids": [reader_me["id"]]},
        headers=author,
    )
    assert created.json()["comment"]["mentions"][0]["id"] == reader_me["id"]

    invalid = await client.post(
        f"/api/v1/posts/{post['id']}/comments",
        json={"content": "halo", "mention_ids": ["0" * 24]},
        headers=author,
    )
    assert invalid.status_code == 422

    with_mention = await quick_post(
        client, author, book["id"], note(), mention_ids=[reader_me["id"]]
    )
    assert with_mention["post"]["mentions"][0]["name"] == reader_me["name"]

    search = await client.get("/api/v1/users", params={"q": unique_name[-6:]}, headers=author)
    assert [u["id"] for u in search.json()] == [reader_me["id"]]


async def test_feed_filters(client, fake_clock, database):
    author, reader, book, post = await _setup(client)
    author_me = await me(client, author)
    other_book = await create_book(client, reader)
    other = (await quick_post(client, reader, other_book["id"], note() + " #unik"))["post"]

    async def items(**params):
        page = (await client.get("/api/v1/feed", params=params, headers=reader)).json()
        return page["items"]

    async def ids(**params):
        return [p["id"] for p in await items(**params)]

    assert await ids(book_id=book["id"]) == [post["id"]]
    assert await ids(topic="unik") == [other["id"]]
    assert await ids(topic="#UNIK") == [other["id"]]
    assert await ids(author_id=author_me["id"]) == [post["id"]]
    by_function = await items(function_id=author_me["function_id"], limit=50)
    assert by_function and all(
        p["author"]["function_id"] == author_me["function_id"] for p in by_function
    )

    # Posting yang disembunyikan moderator tidak muncul.
    from bson import ObjectId

    await database["posts"].update_one(
        {"_id": ObjectId(other["id"])}, {"$set": {"moderation.status": "hidden"}}
    )
    assert await ids(topic="unik") == []


async def test_book_discussion_thread(client, fake_clock):
    author, reader, book, _ = await _setup(client)
    before = (await me(client, reader))["stats"]["points_total"]
    url = f"/api/v1/books/{book['id']}/discussions"
    created = await client.post(
        url,
        json={"content": "Ada yang sudah sampai bab lima? Plot twist-nya seru!"},
        headers=reader,
    )
    assert created.status_code == 201, created.text
    discussion = created.json()
    assert discussion["type"] == "discussion"
    assert (await me(client, reader))["stats"]["points_total"] == before

    assert (await client.post(url, json={"content": "Halo"}, headers=reader)).status_code == 422
    page = (await client.get(f"/api/v1/books/{book['id']}/posts", headers=reader)).json()
    assert page["items"][0]["id"] == discussion["id"]
    feed = (await client.get("/api/v1/feed", params={"type": "discussion"}, headers=reader)).json()
    assert discussion["id"] in [p["id"] for p in feed["items"]]


async def test_share_card_png(client, fake_clock):
    _, reader, _, post = await _setup(client)
    response = await client.get(f"/api/v1/posts/{post['id']}/share-card.png", headers=reader)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(response.content)) as img:
        assert img.size == (1080, 1350)
    missing = await client.get(f"/api/v1/posts/{'0' * 24}/share-card.png", headers=reader)
    assert missing.status_code == 404
