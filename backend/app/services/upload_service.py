import uuid

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock, media
from app.core.errors import AppError
from app.core.images import process_image
from app.core.storage import get_storage
from app.repositories import catalog
from app.schemas.uploads import UploadOut

DEFAULT_MAX_BYTES = 1_048_576


def user_prefix(user_id: ObjectId) -> str:
    return f"photos/{user_id}/"


def owns_key(user_id: ObjectId, key: str) -> bool:
    return key.startswith(user_prefix(user_id)) and ".." not in key


async def max_upload_bytes(db: AsyncDatabase) -> int:
    return int(await catalog.get_setting(db, "upload.max_bytes", DEFAULT_MAX_BYTES))


async def store_photo(db: AsyncDatabase, user_id: ObjectId, raw: bytes) -> UploadOut:
    limit = await max_upload_bytes(db)
    if len(raw) > limit:
        raise AppError(413, "file_too_large", f"Ukuran foto maksimal {limit // 1024} KB")
    image = process_image(raw)
    now = clock.now()
    key = f"{user_prefix(user_id)}{now:%Y%m}/{uuid.uuid4().hex}.jpg"
    await get_storage().put(key, image.data, image.content_type)
    return UploadOut(key=key, url=media.signed_url(key), width=image.width, height=image.height)
