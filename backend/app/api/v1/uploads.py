from typing import Annotated

from fastapi import APIRouter, File, Query, Response, UploadFile, status

from app.api.deps import CurrentUser, Db
from app.core import media
from app.core.errors import AppError
from app.core.rate_limit import rate_limiter
from app.core.storage import get_storage
from app.schemas.uploads import UploadOut
from app.services import avatar_service, upload_service

router = APIRouter(tags=["uploads"])


@router.post("/uploads/photos", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(db: Db, user: CurrentUser, file: Annotated[UploadFile, File()]) -> UploadOut:
    rate_limiter.hit(f"upload:{user['_id']}", limit=30, window_seconds=60)
    limit = await upload_service.max_upload_bytes(db)
    raw = await file.read(limit + 1)
    return await upload_service.store_photo(db, user["_id"], raw)


@router.get("/media/{key:path}", include_in_schema=False)
async def get_media(
    key: str,
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query(max_length=64)],
) -> Response:
    if not media.verify(key, exp, sig):
        raise AppError(403, "invalid_signature", "Tautan media tidak valid atau kedaluwarsa")
    found = await get_storage().get(key)
    if found is None:
        raise AppError(404, "media_not_found", "Media tidak ditemukan")
    data, content_type = found
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/avatars/{name}", include_in_schema=False)
async def get_avatar(name: str) -> Response:
    key = avatar_service.key_for(name)
    found = await get_storage().get(key) if key else None
    if found is None:
        raise AppError(404, "media_not_found", "Media tidak ditemukan")
    data, content_type = found
    # Nama berkas berubah setiap ganti foto → aman di-cache lama.
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
