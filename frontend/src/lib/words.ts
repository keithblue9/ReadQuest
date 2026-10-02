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
  { value: "quick_note", label: "Quick Note", emoji: "⚡" },
  { value: "chapter_story", label: "Chapter Story", emoji: "📖" },
  { value: "book_review", label: "Book Review", emoji: "⭐" },
] as const;

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
