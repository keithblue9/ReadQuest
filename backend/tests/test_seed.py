from app.seed.__main__ import seed


async def test_seed_is_idempotent(database):
    created = await seed(database)
    assert sum(created.values()) == 0
    assert await database["roles"].count_documents({"is_system": True}) == 3
    rules = {r["code"]: r["points"] async for r in database["point_rules"].find()}
    assert rules["session_valid"] == 20
    assert rules["chapter_story"] == 40
    assert rules["book_finished"] == 150


async def test_seed_admin_login_and_legacy_migration(client, database, monkeypatch):
    from app.core.config import get_settings
    from app.seed import __main__ as seed_module
    from tests.conftest import ADMIN_PHONE

    admin = await database["users"].find_one({"phone": ADMIN_PHONE})
    assert admin and admin["password_hash"].startswith("$argon2")
    assert not await database["permissions"].find_one({"code": "invites.manage"})

    # Akun admin lama (login email, tanpa nomor HP) mendapat nomor HP & PIN dari seed.
    legacy_id = (
        await database["users"].insert_one(
            {"email": "lama@example.com", "name": "Admin Lama", "status": "active"}
        )
    ).inserted_id
    settings = get_settings().model_copy(
        update={
            "admin_phone": "0811 0000 0099",
            "admin_pin": "357913",
            "admin_email": "lama@example.com",
        }
    )
    monkeypatch.setattr(seed_module, "get_settings", lambda: settings)
    await seed_module._seed_admin(database, {})
    legacy = await database["users"].find_one({"_id": legacy_id})
    assert legacy["phone"] == "+6281100000099"
    await database["users"].delete_one({"_id": legacy_id})


async def test_seed_on_startup_runs_seed(database, monkeypatch):
    from app import main as main_module
    from app.core.config import get_settings

    calls = []

    async def fake_seed(db):
        calls.append(db.name)
        return {}

    monkeypatch.setattr("app.seed.__main__.seed", fake_seed)
    await main_module.prepare_database(database)
    assert calls == []  # default: tidak seed

    settings = get_settings().model_copy(update={"seed_on_startup": True})
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    await main_module.prepare_database(database)
    assert calls == [database.name]
