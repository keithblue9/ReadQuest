"""Sumber waktu tunggal agar logika berbasis waktu (sesi baca, batas harian) mudah diuji."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo


def now() -> datetime:
    return datetime.now(UTC)


def local_date(moment: datetime, timezone: str) -> str:
    """Tanggal `YYYY-MM-DD` menurut zona waktu pengguna."""
    try:
        tz = ZoneInfo(timezone)
    except Exception:  # noqa: BLE001 - zona waktu tidak valid → fallback
        tz = ZoneInfo("Asia/Jakarta")
    return moment.astimezone(tz).date().isoformat()
