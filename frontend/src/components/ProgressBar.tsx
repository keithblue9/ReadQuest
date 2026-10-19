/**
 * Progres bergaya goresan stabilo. `tone="leaf"` saat target tercapai.
 * Animasi goresan hanya sekali saat tampil dan dimatikan bila pengguna memilih reduced motion.
 */
export function ProgressBar({
  value,
  max,
  label,
  size = "md",
}: {
  value: number;
  max: number;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const done = pct >= 100;
  const height = { sm: "h-2", md: "h-3", lg: "h-4" }[size];
  return (
    <div
      className={`${height} overflow-hidden rounded-[3px] bg-line`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <div
        className={`marker-fill h-full rounded-[3px_9px_6px_3px] transition-[width] duration-700 ${done ? "bg-leaf" : "border-r-[3px] border-ink bg-highlight dark:border-r-0"}`}
        style={{ width: `${pct > 0 ? Math.max(pct, 4) : 0}%` }}
      />
    </div>
  );
}
