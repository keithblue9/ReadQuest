"""Validasi & normalisasi foto: hanya gambar asli, orientasi diperbaiki, metadata (EXIF/GPS)
dibuang dengan re-encode, dimensi dibatasi."""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

MAX_DIMENSION = 1600
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # cegah decompression bomb


@dataclass
class ProcessedImage:
    data: bytes
    content_type: str
    width: int
    height: int


def process_image(raw: bytes) -> ProcessedImage:
    try:
        with Image.open(io.BytesIO(raw)) as img:
            if img.format not in ALLOWED_FORMATS:
                raise AppError(415, "unsupported_image", "Format gambar harus JPEG, PNG, atau WebP")
            img.load()
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            out = io.BytesIO()
            # Re-encode tanpa exif/icc → metadata lokasi & perangkat ikut terbuang.
            img.save(out, format="JPEG", quality=85, optimize=True, progressive=True)
            return ProcessedImage(out.getvalue(), "image/jpeg", img.width, img.height)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise AppError(415, "unsupported_image", "File bukan gambar yang valid") from exc
