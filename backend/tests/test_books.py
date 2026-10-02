from tests.conftest import category_id, create_book, onboarded_user


async def test_create_book_and_dedupe(client):
    headers = await onboarded_user(client)
    book = await create_book(client, headers, title="Atomic Habits", authors=["James Clear"])
    assert book["category"]["name"]
    assert book["stats"]["posts_count"] == 0

    again = await client.post(
        "/api/v1/books",
        json={
            "title": "  atomic   HABITS ",
            "authors": ["James Clear"],
            "category_id": await category_id(client, headers, "pengembangan-diri"),
        },
        headers=headers,
    )
    assert again.status_code == 200
    assert again.json()["id"] == book["id"]


async def test_search_books(client):
    headers = await onboarded_user(client)
    await create_book(client, headers, title="Laskar Pelangi Uji", authors=["Andrea Hirata"])
    by_title = await client.get("/api/v1/books", params={"q": "pelangi uji"}, headers=headers)
    assert any(b["title"] == "Laskar Pelangi Uji" for b in by_title.json())
    by_author = await client.get("/api/v1/books", params={"q": "hirata"}, headers=headers)
    assert any(b["title"] == "Laskar Pelangi Uji" for b in by_author.json())
    regex_chars = await client.get("/api/v1/books", params={"q": "(.*"}, headers=headers)
    assert regex_chars.status_code == 200


async def test_create_book_validation(client):
    headers = await onboarded_user(client)
    bad_category = await client.post(
        "/api/v1/books",
        json={"title": "X", "authors": ["Y"], "category_id": "0" * 24},
        headers=headers,
    )
    assert bad_category.status_code == 422
    no_author = await client.post(
        "/api/v1/books",
        json={"title": "X", "authors": ["  "], "category_id": await category_id(client, headers)},
        headers=headers,
    )
    assert no_author.status_code == 422
    foreign_cover = await client.post(
        "/api/v1/books",
        json={
            "title": "Sampul Orang Lain",
            "authors": ["Y"],
            "category_id": await category_id(client, headers),
            "cover_image_key": "photos/000000000000000000000000/x.jpg",
        },
        headers=headers,
    )
    assert foreign_cover.status_code == 422


async def test_get_book_not_found(client):
    headers = await onboarded_user(client)
    assert (await client.get(f"/api/v1/books/{'0' * 24}", headers=headers)).status_code == 404
