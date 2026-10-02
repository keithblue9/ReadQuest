"""Penyimpanan objek (foto). Backend S3-compatible atau folder lokal."""

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
            except ClientError:
                self.client.create_bucket(Bucket=self.bucket)

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


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        settings = get_settings()
        _storage = (
            LocalStorage(settings.local_storage_dir)
            if settings.storage_backend == "local"
            else S3Storage()
        )
    return _storage
