from app.seed.__main__ import seed


async def test_seed_is_idempotent(database):
    created = await seed(database)
    assert sum(created.values()) == 0
    assert await database["roles"].count_documents({}) == 3
    rules = {r["code"]: r["points"] async for r in database["point_rules"].find()}
    assert rules["session_valid"] == 20
    assert rules["chapter_story"] == 40
    assert rules["book_finished"] == 150
