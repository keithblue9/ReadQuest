import { formatDuration } from "@/lib/words";

export function TimerRing({
  elapsed,
  target,
  running,
}: {
  elapsed: number;
  target: number;
  running: boolean;
}) {
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsed / target);
  const reached = elapsed >= target;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[18rem]">
      <svg viewBox="0 0 280 280" className="size-full -rotate-90" aria-hidden>
        <circle cx="140" cy="140" r={radius} fill="none" strokeWidth="18" className="stroke-border" />
        <circle
          cx="140"
          cy="140"
          r={radius}
          fill="none"
          strokeWidth="18"
          strokeLinecap={progress > 0.01 ? "round" : "butt"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${
            reached ? "stroke-success" : "stroke-primary"
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-5xl font-bold tabular-nums"
          role="timer"
          aria-live="off"
          aria-label={`Waktu baca ${formatDuration(elapsed)}`}
        >
          {formatDuration(elapsed)}
        </span>
        <span className="mt-2 text-sm font-semibold text-muted">
          {reached
            ? "🎯 Target minimal tercapai!"
            : running
              ? `${Math.ceil((target - elapsed) / 60)} menit lagi`
              : "Dijeda"}
        </span>
      </div>
    </div>
  );
}
