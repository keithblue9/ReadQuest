"""URL media bertanda tangan (HMAC) agar foto tim bisa dimuat lewat <img> tanpa header auth.

Masa berlaku dibulatkan ke akhir hari UTC berikutnya sehingga URL stabil seharian dan
bisa di-cache browser.
"""

import hashlib
import hmac
from datetime import timedelta
from urllib.parse import quote

from app.core import clock
from app.core.config import get_settings

MEDIA_PREFIX = "/api/v1/media/"


def _key_bytes() -> bytes:
    return hashlib.sha256(("media:" + get_settings().jwt_secret).encode()).digest()


def _signature(key: str, expires: int) -> str:
    message = f"{key}:{expires}".encode()
    return hmac.new(_key_bytes(), message, hashlib.sha256).hexdigest()[:32]


def signed_url(key: str) -> str:
    today = clock.now().replace(hour=0, minute=0, second=0, microsecond=0)
    expires = int((today + timedelta(days=2)).timestamp())
    return f"{MEDIA_PREFIX}{quote(key)}?exp={expires}&sig={_signature(key, expires)}"


def verify(key: str, expires: int, signature: str) -> bool:
    if expires < clock.now().timestamp():
        return False
    return hmac.compare_digest(_signature(key, expires), signature)
