import type { LeaderboardCategory, LeaderboardEntry } from "@/lib/types";

export const CATEGORIES: {
  value: LeaderboardCategory;
  label: string;
  emoji: string;
  description: string;
  unit: string;
}[] = [
  {
    value: "top_storyteller",
    label: "Top Storyteller",
    emoji: "📝",
    description: "Paling banyak menulis catatan baca.",
    unit: "catatan",
  },
  {
    value: "streak_master",
    label: "Streak Master",
    emoji: "🔥",
    description: "Hari membaca terbanyak (sepanjang masa: streak terpanjang).",
    unit: "hari",
  },
  {
    value: "book_finisher",
    label: "Book Finisher",
    emoji: "📚",
    description: "Paling banyak menyelesaikan buku.",
    unit: "buku",
  },
  {
    value: "most_inspiring",
    label: "Most Inspiring",
    emoji: "✨",
    description: "Paling banyak menerima reaksi dari rekan.",
    unit: "reaksi",
  },
  {
    value: "function_battle",
    label: "Battle Fungsi",
    emoji: "⚔️",
    description: "Rata-rata poin per anggota tiap fungsi — adil untuk tim kecil maupun besar.",
    unit: "poin/anggota",
  },
];

export function categoryInfo(value: LeaderboardCategory) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0];
}

export function entryKey(entry: LeaderboardEntry) {
  return entry.user?.id ?? entry.function?.id ?? String(entry.rank);
}

export function entryName(entry: LeaderboardEntry) {
  return entry.user?.name ?? entry.function?.name ?? "—";
}

export function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
