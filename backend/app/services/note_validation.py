"""Validasi kualitas catatan baca (tanpa I/O, mudah diuji).

Aturan (ambang dari `app_settings`):
- jumlah kata minimal per jenis catatan;
- rasio kata unik minimal (menolak teks yang mengulang kata yang sama);
- kalimat yang sama tidak boleh diulang berkali-kali;
- porsi teks hasil paste dibatasi (sinyal dari klien);
- catatan identik dengan catatan sebelumnya ditolak (lewat `content_hash`).
"""

import hashlib
import re
from dataclasses import dataclass, field

WORD_RE = re.compile(r"[^\W_]+(?:['’-][^\W_]+)*", re.UNICODE)
SENTENCE_SPLIT_RE = re.compile(r"[.!?\n]+")
MIN_REPEATED_SENTENCE_WORDS = 4
MAX_SENTENCE_REPEATS = 2

MESSAGES = {
    "too_short": "Catatan {note_label} minimal {min_words} kata (sekarang {word_count}).",
    "low_unique": "Catatan terlalu banyak mengulang kata yang sama. Ceritakan dengan kata-katamu.",
    "repetitive": "Ada kalimat yang diulang-ulang. Tulis catatan yang lebih bervariasi.",
    "too_much_paste": "Sebagian besar catatan berasal dari teks yang ditempel. Tulis dengan "
    "kata-katamu sendiri.",
    "duplicate": "Catatan ini sama dengan catatan yang pernah kamu kirim.",
}

NOTE_LABELS = {
    "quick_note": "Quick Note",
    "chapter_story": "Chapter Story",
    "book_review": "Book Review",
}


@dataclass
class NoteRules:
    min_words: int
    min_unique_ratio: float
    max_paste_ratio: float


@dataclass
class NoteCheck:
    word_count: int
    unique_word_ratio: float
    pasted_chars: int
    content_hash: str
    reasons: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.reasons


def tokenize(text: str) -> list[str]:
    return [w.lower() for w in WORD_RE.findall(text)]


def content_hash(tokens: list[str]) -> str:
    return hashlib.sha256(" ".join(tokens).encode()).hexdigest()


def _has_repeated_sentences(text: str) -> bool:
    counts: dict[str, int] = {}
    for sentence in SENTENCE_SPLIT_RE.split(text):
        words = tokenize(sentence)
        if len(words) < MIN_REPEATED_SENTENCE_WORDS:
            continue
        key = " ".join(words)
        counts[key] = counts.get(key, 0) + 1
        if counts[key] > MAX_SENTENCE_REPEATS:
            return True
    return False


def check_note(text: str, rules: NoteRules, pasted_chars: int = 0) -> NoteCheck:
    tokens = tokenize(text)
    word_count = len(tokens)
    unique_ratio = len(set(tokens)) / word_count if word_count else 0.0
    pasted = max(0, min(pasted_chars, len(text)))
    result = NoteCheck(
        word_count=word_count,
        unique_word_ratio=round(unique_ratio, 3),
        pasted_chars=pasted,
        content_hash=content_hash(tokens),
    )

    if word_count < rules.min_words:
        result.reasons.append("too_short")
    if word_count and unique_ratio < rules.min_unique_ratio:
        result.reasons.append("low_unique")
    if _has_repeated_sentences(text):
        result.reasons.append("repetitive")
    if text.strip() and pasted / len(text.strip()) > rules.max_paste_ratio:
        result.reasons.append("too_much_paste")
    return result


def message_for(reason: str, note_type: str, rules: NoteRules, word_count: int) -> str:
    return MESSAGES[reason].format(
        note_label=NOTE_LABELS.get(note_type, note_type),
        min_words=rules.min_words,
        word_count=word_count,
    )
