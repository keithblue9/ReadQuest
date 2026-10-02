from app.services.note_validation import NoteRules, check_note, tokenize

RULES = NoteRules(min_words=30, min_unique_ratio=0.4, max_paste_ratio=0.5)

GOOD_NOTE = (
    "Bab ketiga membahas bagaimana kebiasaan kecil yang dilakukan setiap hari bisa "
    "menghasilkan perubahan besar dalam jangka panjang. Penulis memberi contoh atlet "
    "sepeda Inggris yang memperbaiki banyak detail sederhana. Saya ingin mencoba "
    "membaca lima belas menit sebelum tidur mulai minggu ini."
)


def test_tokenize_handles_unicode_and_apostrophes():
    assert tokenize("Don't stop—baca 15 menit, ya!") == [
        "don't",
        "stop",
        "baca",
        "15",
        "menit",
        "ya",
    ]


def test_good_note_passes():
    result = check_note(GOOD_NOTE, RULES)
    assert result.passed, result.reasons
    assert result.word_count >= 30


def test_too_short():
    result = check_note("Buku ini bagus sekali.", RULES)
    assert "too_short" in result.reasons


def test_low_unique_word_ratio():
    result = check_note("bagus " * 40, RULES)
    assert "low_unique" in result.reasons


def test_repeated_sentences():
    sentence = "Buku ini sangat menginspirasi saya hari ini. "
    text = sentence * 3 + GOOD_NOTE
    assert "repetitive" in check_note(text, RULES).reasons


def test_mass_paste_rejected():
    result = check_note(GOOD_NOTE, RULES, pasted_chars=len(GOOD_NOTE))
    assert "too_much_paste" in result.reasons


def test_small_paste_allowed():
    result = check_note(GOOD_NOTE, RULES, pasted_chars=20)
    assert result.passed


def test_hash_ignores_case_and_punctuation():
    a = check_note("Halo, Dunia!", RULES).content_hash
    b = check_note("halo dunia", RULES).content_hash
    assert a == b
