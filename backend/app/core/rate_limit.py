import time
from collections import defaultdict, deque

from app.core.config import get_settings
from app.core.errors import AppError


class RateLimiter:
    """Sliding-window rate limiter di memori.

    Cukup untuk satu instance backend; diganti Redis bila backend di-scale horizontal.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, limit: int, window_seconds: int) -> None:
        if not get_settings().rate_limit_enabled:
            return
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            raise AppError(429, "rate_limited", "Terlalu banyak percobaan, coba lagi nanti")
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()


rate_limiter = RateLimiter()
