from pydantic import BaseModel, Field, field_validator

from app.core.phone_pin import normalize_phone, validate_pin
from app.schemas.common import PyObjectId
from app.schemas.user import MeOut, validate_timezone


def _clean_name(v: str) -> str:
    v = " ".join(v.split())
    if len(v) < 2:
        raise ValueError("Nama minimal 2 karakter")
    return v


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    function_id: PyObjectId
    phone: str = Field(max_length=32)
    pin: str
    timezone: str = "Asia/Jakarta"

    _name = field_validator("name")(lambda cls, v: _clean_name(v))
    _phone = field_validator("phone")(lambda cls, v: normalize_phone(v))
    _pin = field_validator("pin")(lambda cls, v: validate_pin(v))
    _tz = field_validator("timezone")(validate_timezone)


class QuickRegisterIn(BaseModel):
    """Daftar di mode masuk tanpa PIN: cukup nama + fungsi."""

    name: str = Field(min_length=2, max_length=80)
    function_id: PyObjectId
    timezone: str = "Asia/Jakarta"

    _name = field_validator("name")(lambda cls, v: _clean_name(v))
    _tz = field_validator("timezone")(validate_timezone)


class EnterIn(BaseModel):
    user_id: PyObjectId


class MemberOption(BaseModel):
    """Entri daftar "pilih namamu" (publik di mode masuk tanpa PIN): tanpa nomor HP."""

    id: PyObjectId
    name: str
    function: str | None = None
    avatar_url: str | None = None


class LoginIn(BaseModel):
    phone: str = Field(max_length=32)
    pin: str = Field(min_length=1, max_length=12)

    _phone = field_validator("phone")(lambda cls, v: normalize_phone(v))


class ChangePinIn(BaseModel):
    current_pin: str = Field(min_length=1, max_length=12)
    new_pin: str

    _pin = field_validator("new_pin")(lambda cls, v: validate_pin(v))


class FunctionOption(BaseModel):
    id: PyObjectId
    name: str
    parent_id: PyObjectId | None = None


class RegisterOptionsOut(BaseModel):
    functions: list[FunctionOption]
    open_login: bool = False


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: MeOut
