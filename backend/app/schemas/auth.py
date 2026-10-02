from pydantic import BaseModel, Field, field_validator

from app.core.phone_pin import normalize_phone, validate_pin
from app.schemas.common import PyObjectId
from app.schemas.user import MeOut, validate_timezone


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    function_id: PyObjectId
    phone: str = Field(max_length=32)
    pin: str
    timezone: str = "Asia/Jakarta"

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Nama minimal 2 karakter")
        return v

    _phone = field_validator("phone")(lambda cls, v: normalize_phone(v))
    _pin = field_validator("pin")(lambda cls, v: validate_pin(v))
    _tz = field_validator("timezone")(validate_timezone)


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


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: MeOut
