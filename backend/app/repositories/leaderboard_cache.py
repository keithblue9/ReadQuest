from pymongo.asynchronous.database import AsyncDatabase


async def invalidate_open(db: AsyncDatabase) -> None:
    """Buang cache leaderboard periode berjalan setelah data peringkat berubah.

    Snapshot periode yang sudah final tidak disentuh.
    """
    await db["leaderboard_snapshots"].delete_many({"is_final": {"$ne": True}})
