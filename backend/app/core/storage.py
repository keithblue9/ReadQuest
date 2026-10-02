"""Penyimpanan objek (foto). Backend MongoDB, S3-compatible, atau folder lokal."""

from pathlib import Path
from typing import Protocol

import anyio

from app.core.config import get_settings

DEFAULT_CONTENT_TYPE = "application/octet-stream"


class Storage(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...

    async def get(self, key: str) -> tuple[bytes, str] | None: ...

    async def ensure_ready(self) -> None: ...


class LocalStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("key tidak valid")
        return path

    async def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)

        def _write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            path.with_name(path.name + ".type").write_text(content_type)

        await anyio.to_thread.run_sync(_write)

    async def get(self, key: str) -> tuple[bytes, str] | None:
        path = self._path(key)

        def _read() -> tuple[bytes, str] | None:
            if not path.is_file():
                return None
            type_file = path.with_name(path.name + ".type")
            content_type = type_file.read_text() if type_file.exists() else DEFAULT_CONTENT_TYPE
            return path.read_bytes(), content_type

        return await anyio.to_thread.run_sync(_read)


class S3Storage:
    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        settings = get_settings()
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    async def ensure_ready(self) -> None:
        from botocore.exceptions import ClientError

        def _ensure() -> None:
            try:
                self.client.head_bucket(Bucket=self.bucket)
            except ClientError as exc:
                code = str(exc.response.get("Error", {}).get("Code", ""))
                if code in {"404", "NoSuchBucket", "NotFound"}:
                    self.client.create_bucket(Bucket=self.bucket)
                elif code not in {"403", "AccessDenied", "Forbidden"}:
                    raise
                # 403: token hanya berhak atas objek (mis. Cloudflare R2) — bucket dibuat manual.

        await anyio.to_thread.run_sync(_ensure)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await anyio.to_thread.run_sync(
            lambda: self.client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=content_type
            )
        )

    async def get(self, key: str) -> tuple[bytes, str] | None:
        from botocore.exceptions import ClientError

        def _get() -> tuple[bytes, str] | None:
            try:
                obj = self.client.get_object(Bucket=self.bucket, Key=key)
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                    return None
                raise
            return obj["Body"].read(), obj.get("ContentType", DEFAULT_CONTENT_TYPE)

        return await anyio.to_thread.run_sync(_get)


class MongoStorage:
    """Foto disimpan di koleksi `media` (cocok untuk host tanpa disk permanen, mis. Render).

    Foto sudah dikompres klien (~1 MB) dan dibatasi `upload.max_bytes` (maks 10 MB), jadi muat
    dalam satu dokumen BSON (batas 16 MB) tanpa GridFS.
    """

    async def ensure_ready(self) -> None:
        # Index `key` unik dibuat oleh ensure_indexes (app/repositories/indexes.py).
        return None

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        from datetime import UTC, datetime

        from bson import Binary

        from app.core.db import get_db

        await get_db()["media"].update_one(
            {"key": key},
            {
                "$set": {
                    "data": Binary(data),
                    "content_type": content_type,
                    "size": len(data),
                    "created_at": datetime.now(UTC),
                }
            },
            upsert=True,
        )

    async def get(self, key: str) -> tuple[bytes, str] | None:
        from app.core.db import get_db

        doc = await get_db()["media"].find_one({"key": key})
        if doc is None:
            return None
        return bytes(doc["data"]), doc.get("content_type", DEFAULT_CONTENT_TYPE)


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        settings = get_settings()
        if settings.storage_backend == "local":
            _storage = LocalStorage(settings.local_storage_dir)
        elif settings.storage_backend == "mongo":
            _storage = MongoStorage()
        else:
            _storage = S3Storage()
    return _storage
