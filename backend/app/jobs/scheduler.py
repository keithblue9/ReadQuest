"""Scheduler ringan: satu loop asyncio yang berdetak setiap menit.

Hanya satu instance backend yang menjalankan job (lease di koleksi `job_locks`), sehingga aman
saat backend di-scale. Job harian/mingguan memakai kunci di `scheduled_runs` agar tidak ganda.
"""

import asyncio
import contextlib
import logging
import os
import socket
from datetime import timedelta

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core import clock
from app.jobs import notification_jobs
from app.services import push_service

log = logging.getLogger(__name__)
TICK_SECONDS = 60
LEASE = timedelta(seconds=90)
OWNER = f"{socket.gethostname()}:{os.getpid()}"

JOBS = [
    ("authenticity", notification_jobs.daily_authenticity),
    ("reading_reminders", notification_jobs.reading_reminders),
    ("streak_at_risk", notification_jobs.streak_at_risk),
    ("weekly_leaderboard", notification_jobs.weekly_leaderboard),
    ("new_quests", notification_jobs.new_quests),
]


async def acquire_lease(db: AsyncDatabase) -> bool:
    now = clock.now()
    try:
        result = await db["job_locks"].find_one_and_update(
            {"_id": "scheduler", "$or": [{"expires_at": {"$lt": now}}, {"owner": OWNER}]},
            {"$set": {"owner": OWNER, "expires_at": now + LEASE}},
            upsert=True,
        )
    except DuplicateKeyError:
        return False  # instance lain memegang lease
    return result is None or result.get("owner") == OWNER or result["expires_at"] < now


async def tick(db: AsyncDatabase) -> dict[str, int]:
    """Satu putaran semua job (dipanggil langsung di test)."""
    results: dict[str, int] = {}
    for name, job in JOBS:
        try:
            results[name] = await job(db)
        except Exception:  # noqa: BLE001 - satu job gagal tidak menghentikan yang lain
            log.exception("Job %s gagal", name)
    try:
        results.update(await push_service.dispatch_due(db))
    except Exception:  # noqa: BLE001
        log.exception("Pengiriman push gagal")
    return results


async def run_forever(get_db) -> None:
    while True:
        try:
            db = get_db()
            if await acquire_lease(db):
                await tick(db)
        except Exception:  # noqa: BLE001
            log.exception("Tick scheduler gagal")
        await asyncio.sleep(TICK_SECONDS)


class Scheduler:
    def __init__(self) -> None:
        self.task: asyncio.Task | None = None

    def start(self, get_db) -> None:
        self.task = asyncio.create_task(run_forever(get_db))

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task


scheduler = Scheduler()
