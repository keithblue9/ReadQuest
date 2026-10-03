"""Kartu berbagi (PNG 1080x1350) untuk WhatsApp/LinkedIn/Instagram story."""

import io
import textwrap
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.core.storage import get_storage
from app.services import ui_config_service

FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "Nunito.ttf"
WIDTH, HEIGHT = 1080, 1350
# Palet profesional (biru + teal), selaras dengan tema aplikasi.
PRIMARY = (37, 99, 235)
PRIMARY_DARK = (23, 37, 84)
ACCENT = (45, 212, 191)
CREAM = (248, 250, 252)
INK = (15, 23, 42)
MUTED = (100, 116, 139)
NOTE_LABELS = {
    "quick_note": "Quick Note",
    "chapter_story": "Chapter Story",
    "book_review": "Book Review",
    "takeaway": "Takeaway",
    "quote": "Kutipan",
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


async def render(post: dict, branding: dict | None = None) -> bytes:
    photo = None
    if post.get("image_keys"):
        found = await get_storage().get(post["image_keys"][0])
        if found:
            try:
                photo = Image.open(io.BytesIO(found[0])).convert("RGB")
            except OSError:
                photo = None
    return _render_sync(post, photo, branding or {"app_name": "ReadQuest", "tagline": ""})


def _render_sync(post: dict, photo: Image.Image | None, branding: dict) -> bytes:
    img = _gradient()
    draw = ImageDraw.Draw(img)
    margin = 80

    # Brand
    first, second = ui_config_service.split_brand(branding["app_name"])
    brand_font = _font(54, "ExtraBold")
    draw.text((margin, 70), first, font=brand_font, fill=CREAM)
    first_w = draw.textlength(first, font=brand_font)
    draw.text((margin + first_w, 70), second, font=brand_font, fill=ACCENT)
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
    draw.text((inner_x - 8, y - 30), "“", font=_font(140, "Black"), fill=PRIMARY)
    body_font = _font(40, "Medium")
    available_lines = max(3, int((card[3] - 150 - (y + 70)) / 58))
    body = (post.get("quote") or {}).get("text") or post["content"]
    for line in _wrap(draw, " ".join(body.split()), body_font, inner_w, available_lines):
        draw.text((inner_x, y + 70), line, font=body_font, fill=INK)
        y += 58

    # Penulis
    footer_y = card[3] - 110
    draw.line(
        (inner_x, footer_y - 24, inner_x + inner_w, footer_y - 24), fill=(226, 232, 240), width=3
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
    slogan = textwrap.shorten(branding.get("tagline") or "", width=40, placeholder="…")
    tagline = f"{slogan} · {branding['app_name']}" if slogan else branding["app_name"]
    tag_font = _font(34, "Bold")
    tw = draw.textlength(tagline, font=tag_font)
    draw.text(((WIDTH - tw) / 2, HEIGHT - 120), tagline, font=tag_font, fill=CREAM)

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


MONTHS_ID = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
]


def render_badge(*, holder: str, badge: dict, awarded_at, branding: dict) -> bytes:
    """Sertifikat pencapaian 1200×628 (rasio pratinjau LinkedIn) untuk dibagikan."""
    width, height = 1200, 628
    img = Image.new("RGB", (width, height), CREAM)
    draw = ImageDraw.Draw(img)
    # Pita kiri bergradasi + medali.
    band = Image.linear_gradient("L").rotate(90).resize((380, height))
    img.paste(
        Image.composite(
            Image.new("RGB", (380, height), PRIMARY_DARK),
            Image.new("RGB", (380, height), PRIMARY),
            band,
        ),
        (0, 0),
    )
    cx, cy, r = 190, 290, 120
    draw.ellipse((cx - r - 14, cy - r - 14, cx + r + 14, cy + r + 14), fill=ACCENT)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CREAM)
    initials = "".join(w[0] for w in badge["name"].split()[:2]).upper() or "★"
    medal_font = _font(96, "Black")
    iw = draw.textlength(initials, font=medal_font)
    draw.text((cx - iw / 2, cy - 62), initials, font=medal_font, fill=PRIMARY)
    draw.polygon([(cx - 70, cy + r), (cx - 20, cy + r + 150), (cx, cy + r + 110)], fill=ACCENT)
    draw.polygon([(cx + 70, cy + r), (cx + 20, cy + r + 150), (cx, cy + r + 110)], fill=ACCENT)

    x = 450
    first, second = ui_config_service.split_brand(branding["app_name"])
    brand_font = _font(40, "ExtraBold")
    draw.text((x, 60), first, font=brand_font, fill=INK)
    draw.text(
        (x + draw.textlength(first, font=brand_font), 60), second, font=brand_font, fill=PRIMARY
    )
    draw.text((x, 150), "SERTIFIKAT PENCAPAIAN", font=_font(28, "Bold"), fill=MUTED)
    y = 200
    for line in _wrap(draw, badge["name"], _font(72, "Black"), width - x - 60, 2):
        draw.text((x, y), line, font=_font(72, "Black"), fill=INK)
        y += 84
    for line in _wrap(draw, badge.get("description", ""), _font(32, "Medium"), width - x - 60, 2):
        draw.text((x, y + 10), line, font=_font(32, "Medium"), fill=MUTED)
        y += 42
    draw.line((x, height - 170, width - 60, height - 170), fill=(226, 232, 240), width=3)
    draw.text((x, height - 145), "Diberikan kepada", font=_font(26, "SemiBold"), fill=MUTED)
    holder_line = textwrap.shorten(holder, width=34, placeholder="…")
    draw.text((x, height - 110), holder_line, font=_font(42, "ExtraBold"), fill=INK)
    if awarded_at:
        when = f"{awarded_at.day} {MONTHS_ID[awarded_at.month - 1]} {awarded_at.year}"
        wf = _font(28, "SemiBold")
        draw.text(
            (width - 60 - draw.textlength(when, font=wf), height - 100), when, font=wf, fill=MUTED
        )
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
