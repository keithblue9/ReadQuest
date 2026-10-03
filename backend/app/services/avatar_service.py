"""Foto profil: dipotong persegi 256 px, metadata dibuang.

URL foto stabil (`/api/v1/avatars/<uuid>.jpg`) dan tidak bertanda tangan agar bisa dipakai di
`<img>` mana pun tanpa kedaluwarsa; nama berkas acak sehingga tidak bisa ditebak.
"""

import io
import uuid

from PIL import Image, ImageOps
from pymongo.asynchronous.database import AsyncDatabase

from app.core.errors import AppError
from app.core.images import process_image
from app.core.storage import get_storage
from app.repositories import users

MAX_BYTES = 8 * 1024 * 1024
SIZE = 256
PREFIX = "avatars/"
URL_PREFIX = "/api/v1/avatars/"


def _square(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as img:
        square = ImageOps.fit(img.convert("RGB"), (SIZE, SIZE), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        square.save(out, format="JPEG", quality=88, optimize=True)
        return out.getvalue()


async def set_avatar(db: AsyncDatabase, user: dict, raw: bytes) -> dict:
    if len(raw) > MAX_BYTES:
        raise AppError(413, "file_too_large", "Ukuran foto maksimal 8 MB")
    image = process_image(raw, max_dimension=1024)
    name = f"{uuid.uuid4().hex}.jpg"
    await get_storage().put(f"{PREFIX}{name}", _square(image.data), "image/jpeg")
    return await users.update(db, user["_id"], {"avatar_url": f"{URL_PREFIX}{name}"})


async def remove_avatar(db: AsyncDatabase, user: dict) -> dict:
    return await users.update(db, user["_id"], {"avatar_url": None})


def key_for(name: str) -> str | None:
    """Nama berkas dari URL → kunci storage; hanya `<hex32>.jpg` yang valid."""
    stem, _, ext = name.partition(".")
    if ext != "jpg" or len(stem) != 32 or any(c not in "0123456789abcdef" for c in stem):
        return None
    return f"{PREFIX}{name}"
