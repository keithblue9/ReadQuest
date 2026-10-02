import type { AuthenticityStatus } from "@/lib/types";

export const STATUS_STYLE: Record<AuthenticityStatus, { emoji: string; className: string; hint: string }> = {
  active_reader: {
    emoji: "🌟",
    className: "bg-success/15 text-success",
    hint: "Kamu aktif membaca dan berbagi catatan. Pertahankan!",
  },
  warming_up: {
    emoji: "🌤️",
    className: "bg-accent/15 text-accent",
    hint: "Sudah mulai berbagi. Tambah satu catatan lagi untuk jadi Active Reader.",
  },
  observer: {
    emoji: "👀",
    className: "bg-primary/15 text-primary",
    hint: "Kamu rajin menyemangati rekan. Yuk bagikan catatan bacaanmu sendiri juga!",
  },
  silent: {
    emoji: "🌙",
    className: "bg-surface-muted text-muted",
    hint: "Belum ada aktivitas 30 hari terakhir. 15 menit membaca sudah cukup untuk mulai.",
  },
};

export function StatusBadge({ status, label }: { status: AuthenticityStatus; label: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${style.className}`}>
      <span aria-hidden>{style.emoji}</span>
      {label}
    </span>
  );
}
