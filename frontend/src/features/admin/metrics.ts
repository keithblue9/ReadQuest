/** Label metrik statistik pengguna (sinkron dengan `user_stats.METRICS` di backend). */
export const METRIC_LABELS: Record<string, string> = {
  sessions_count: "Jumlah sesi baca",
  reading_minutes: "Total menit baca",
  reading_days: "Hari membaca",
  notes_count: "Jumlah catatan",
  chapter_story_count: "Chapter Story",
  book_review_count: "Book Review",
  discussion_count: "Diskusi buku",
  books_finished: "Buku selesai",
  meaningful_comments_given: "Komentar bermakna diberikan",
  reactions_given: "Reaksi diberikan",
  reactions_received: "Reaksi diterima",
  streak_longest: "Streak terpanjang (hari)",
};

export const METRIC_OPTIONS = Object.entries(METRIC_LABELS).map(([value, label]) => ({ value, label }));

export const metricLabel = (code: unknown) => METRIC_LABELS[String(code)] ?? String(code);
