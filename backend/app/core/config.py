from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-please"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    frontend_origin: str = "http://localhost:3000"

    mongodb_uri: str = "mongodb://localhost:27017/?replicaSet=rs0"
    mongodb_db: str = "readquest"

    jwt_secret: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 15
    jwt_refresh_ttl_days: int = 30

    cookie_secure: bool = False

    rate_limit_enabled: bool = True

    # Object storage untuk foto. "s3" (RustFS/S3/R2) atau "local" (folder, untuk test/dev).
    storage_backend: Literal["s3", "local"] = "s3"
    local_storage_dir: str = "./.storage"
    s3_endpoint_url: str | None = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket: str = "readquest-photos"

    # Web Push (VAPID). Kosong = push dinonaktifkan (notifikasi in-app tetap jalan).
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str = "mailto:admin@example.com"

    # Scheduler internal (pengingat, nudge, ringkasan mingguan, pengiriman push).
    scheduler_enabled: bool = True

    # Seed: admin pertama & kode undangan awal (opsional)
    admin_email: str | None = None
    admin_password: str | None = Field(default=None, min_length=8)
    admin_name: str = "Admin"
    seed_invite_code: str | None = None

    @model_validator(mode="after")
    def _check_secrets(self) -> "Settings":
        if self.app_env != "production" and len(self.jwt_secret) < 32:
            # Dev/test: placeholder kosong/pendek diganti secret dev agar tetap bisa jalan.
            self.jwt_secret = _DEV_JWT_SECRET
        if self.app_env == "production":
            if self.jwt_secret == _DEV_JWT_SECRET or len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET wajib diisi (min. 32 karakter) di production")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE wajib true di production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
