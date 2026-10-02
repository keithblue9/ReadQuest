import type { Level } from "@/lib/types";

export function LevelProgress({ level, points }: { level: Level | null; points: number }) {
  if (!level) return null;
  const span = level.next_min_points ? level.next_min_points - level.min_points : 1;
  const progress = level.next_min_points ? Math.min(1, (points - level.min_points) / span) : 1;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-extrabold">
          Lv. {level.level} · {level.title}
        </span>
        <span className="text-xs font-semibold text-muted">
          {level.next_min_points
            ? `${level.next_min_points - points} poin lagi → ${level.next_title ?? "level berikutnya"}`
            : "Level tertinggi 🏅"}
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Progres level"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700"
          style={{ width: `${Math.max(3, progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
