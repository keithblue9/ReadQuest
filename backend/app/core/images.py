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


def process_image(
    raw: bytes, *, max_dimension: int = MAX_DIMENSION, keep_alpha: bool = False
) -> ProcessedImage:
    """`keep_alpha=True` (logo) menyimpan PNG bila gambar transparan; selain itu JPEG."""
    try:
        with Image.open(io.BytesIO(raw)) as img:
            if img.format not in ALLOWED_FORMATS:
                raise AppError(415, "unsupported_image", "Format gambar harus JPEG, PNG, atau WebP")
            img.load()
            img = ImageOps.exif_transpose(img)
            transparent = keep_alpha and (
                img.mode in {"RGBA", "LA", "PA"} or "transparency" in img.info
            )
            img = img.convert("RGBA" if transparent else "RGB")
            img.thumbnail((max_dimension, max_dimension))
            out = io.BytesIO()
            # Re-encode tanpa exif/icc → metadata lokasi & perangkat ikut terbuang.
            if transparent:
                img.save(out, format="PNG", optimize=True)
                return ProcessedImage(out.getvalue(), "image/png", img.width, img.height)
            img.save(out, format="JPEG", quality=85, optimize=True, progressive=True)
            return ProcessedImage(out.getvalue(), "image/jpeg", img.width, img.height)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise AppError(415, "unsupported_image", "File bukan gambar yang valid") from exc
