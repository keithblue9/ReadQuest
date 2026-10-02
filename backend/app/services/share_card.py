"""Kartu berbagi (PNG 1080x1350) untuk WhatsApp/LinkedIn/Instagram story."""

import io
import textwrap
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.core.storage import get_storage

FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "Nunito.ttf"
WIDTH, HEIGHT = 1080, 1350
PRIMARY = (108, 77, 246)
PRIMARY_DARK = (72, 46, 196)
ACCENT = (255, 138, 61)
CREAM = (255, 248, 240)
INK = (31, 27, 46)
MUTED = (107, 100, 128)
NOTE_LABELS = {
    "quick_note": "Quick Note",
    "chapter_story": "Chapter Story",
    "book_review": "Book Review",
    "discussion": "Diskusi",
}


@lru_cache(maxsize=32)
def _font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_PATH), size)
    try:
        font.set_variation_by_name(weight)
    except (OSError, ValueError):
        pass
    return font


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) == max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    consumed = len(" ".join(lines).split())
    if consumed < len(words) and lines:
        last = lines[-1]
        while last and draw.textlength(last + "…", font=font) > max_width:
            last = last.rsplit(" ", 1)[0] if " " in last else last[:-1]
        lines[-1] = last + "…"
    return lines


def _gradient() -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT), PRIMARY)
    top = Image.new("RGB", (WIDTH, HEIGHT), PRIMARY_DARK)
    mask = Image.linear_gradient("L").resize((WIDTH, HEIGHT))
    return Image.composite(top, base, ImageOps.invert(mask))


async def render(post: dict) -> bytes:
    photo = None
    if post.get("image_keys"):
        found = await get_storage().get(post["image_keys"][0])
        if found:
            try:
                photo = Image.open(io.BytesIO(found[0])).convert("RGB")
            except OSError:
                photo = None
    return _render_sync(post, photo)


def _render_sync(post: dict, photo: Image.Image | None) -> bytes:
    img = _gradient()
    draw = ImageDraw.Draw(img)
    margin = 80

    # Brand
    draw.text((margin, 70), "Read", font=_font(54, "ExtraBold"), fill=CREAM)
    read_w = draw.textlength("Read", font=_font(54, "ExtraBold"))
    draw.text((margin + read_w, 70), "Quest", font=_font(54, "ExtraBold"), fill=ACCENT)
    label = NOTE_LABELS.get(post["type"], "Catatan")
    label_font = _font(30, "Bold")
    label_w = draw.textlength(label, font=label_font) + 48
    draw.rounded_rectangle(
        (WIDTH - margin - label_w, 74, WIDTH - margin, 128), radius=27, fill=(255, 255, 255)
    )
    draw.text((WIDTH - margin - label_w + 24, 83), label, font=label_font, fill=PRIMARY)

    # Kartu isi
    card_top = 190
    card = (margin - 20, card_top, WIDTH - margin + 20, HEIGHT - 190)
    draw.rounded_rectangle(card, radius=48, fill=CREAM)
    inner_x = card[0] + 56
    inner_w = card[2] - card[0] - 112
    y = card_top + 56

    if photo is not None:
        thumb = ImageOps.fit(photo, (180, 240))
        rounded = Image.new("L", thumb.size, 0)
        ImageDraw.Draw(rounded).rounded_rectangle((0, 0, *thumb.size), radius=24, fill=255)
        img.paste(thumb, (inner_x, y), rounded)
        text_x = inner_x + 210
        text_w = inner_w - 210
    else:
        text_x, text_w = inner_x, inner_w

    book = post["book"]
    title_lines = _wrap(draw, book["title"], _font(50, "ExtraBold"), text_w, 3)
    ty = y + 6
    for line in title_lines:
        draw.text((text_x, ty), line, font=_font(50, "ExtraBold"), fill=INK)
        ty += 62
    author_line = _wrap(draw, ", ".join(book["authors"]), _font(34, "SemiBold"), text_w, 1)
    draw.text(
        (text_x, ty + 6),
        author_line[0] if author_line else "",
        font=_font(34, "SemiBold"),
        fill=MUTED,
    )
    y = max(y + 270, ty + 70) if photo is not None else ty + 80

    # Kutipan catatan
    draw.text((inner_x - 8, y - 30), "“", font=_font(140, "Black"), fill=ACCENT)
    body_font = _font(40, "Medium")
    available_lines = max(3, int((card[3] - 150 - (y + 70)) / 58))
    for line in _wrap(draw, " ".join(post["content"].split()), body_font, inner_w, available_lines):
        draw.text((inner_x, y + 70), line, font=body_font, fill=INK)
        y += 58

    # Penulis
    footer_y = card[3] - 110
    draw.line(
        (inner_x, footer_y - 24, inner_x + inner_w, footer_y - 24), fill=(236, 227, 214), width=3
    )
    name = textwrap.shorten(post["author"]["name"], width=32, placeholder="…")
    draw.ellipse((inner_x, footer_y, inner_x + 64, footer_y + 64), fill=ACCENT)
    initial_font = _font(34, "ExtraBold")
    initial = name[:1].upper()
    iw = draw.textlength(initial, font=initial_font)
    draw.text(
        (inner_x + 32 - iw / 2, footer_y + 8), initial, font=initial_font, fill=(255, 255, 255)
    )
    draw.text((inner_x + 88, footer_y + 8), name, font=_font(36, "Bold"), fill=INK)

    # Tagline
    tagline = "Baca 15 menit sehari · ReadQuest"
    tag_font = _font(34, "Bold")
    tw = draw.textlength(tagline, font=tag_font)
    draw.text(((WIDTH - tw) / 2, HEIGHT - 120), tagline, font=tag_font, fill=CREAM)

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
