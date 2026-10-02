"""Normalisasi nomor HP & validasi PIN 6 angka (login yang ramah HP)."""

import re

_PHONE_DIGITS = re.compile(r"^\+[1-9]\d{8,14}$")
# PIN yang terlalu mudah ditebak selain pola berulang/berurutan.
_COMMON_PINS = {"112233", "121212", "123123", "131313", "696969", "102030", "147258", "159753"}


def normalize_phone(raw: str) -> str:
    """`0812-3456 7890`, `62812…`, `+62 812…` → `+6281234567890`. ValueError bila tidak valid."""
    value = re.sub(r"[\s\-().]", "", raw or "")
    if value.startswith("00"):
        value = "+" + value[2:]
    elif value.startswith("0"):
        value = "+62" + value[1:]
    elif value.startswith("62"):
        value = "+" + value
    elif value.startswith("8"):
        value = "+62" + value
    if not _PHONE_DIGITS.match(value):
        raise ValueError("Nomor HP tidak valid")
    return value


def validate_pin(pin: str) -> str:
    """PIN tepat 6 angka dan tidak mudah ditebak."""
    if not re.fullmatch(r"\d{6}", pin or ""):
        raise ValueError("PIN harus 6 angka")
    digits = [int(c) for c in pin]
    steps = {b - a for a, b in zip(digits, digits[1:], strict=False)}
    if len(set(pin)) == 1 or steps in ({1}, {-1}) or pin in _COMMON_PINS:
        raise ValueError("PIN terlalu mudah ditebak, pilih kombinasi lain")
    return pin
