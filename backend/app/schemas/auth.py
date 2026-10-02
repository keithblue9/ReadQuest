from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import MeOut, validate_timezone


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=80)
    invite_code: str = Field(min_length=4, max_length=64)
    timezone: str = "Asia/Jakarta"

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Nama minimal 2 karakter")
        return v

    _tz = field_validator("timezone")(validate_timezone)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: MeOut
