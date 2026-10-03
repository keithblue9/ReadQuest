// Harus sejalan dengan backend/app/services/note_validation.py (WORD_RE).
const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function tokenize(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
}

export function noteStats(text: string) {
  const tokens = tokenize(text);
  const unique = new Set(tokens).size;
  return {
    wordCount: tokens.length,
    uniqueRatio: tokens.length ? unique / tokens.length : 0,
  };
}

export const NOTE_TYPES = [
  { value: "takeaway", label: "Takeaway 1 Menit", emoji: "⚡", hint: "Satu kalimat inti" },
  { value: "quick_note", label: "Quick Note", emoji: "📝", hint: "Catatan singkat" },
  { value: "chapter_story", label: "Chapter Story", emoji: "📖", hint: "Cerita per bab" },
  { value: "book_review", label: "Book Review", emoji: "⭐", hint: "Ulasan lengkap" },
] as const;

/** Template Takeaway: awalan kalimat agar menulis cukup 1 menit. */
export const TAKEAWAY_TEMPLATES = [
  { kind: "insight", label: "Insight", prefix: "Insight utama: ", placeholder: "ide paling penting dari bacaan ini…" },
  { kind: "action", label: "Aksi", prefix: "Yang akan saya terapkan: ", placeholder: "satu hal yang akan dicoba di kerjaan…" },
  { kind: "quote", label: "Kutipan", prefix: "Kalimat favorit: ", placeholder: "kutipan yang paling mengena…" },
] as const;

export const POST_TYPE_LABEL: Record<string, string> = {
  takeaway: "Takeaway",
  quick_note: "Quick Note",
  chapter_story: "Chapter Story",
  book_review: "Book Review",
  discussion: "Diskusi",
  quote: "Kutipan",
};

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
