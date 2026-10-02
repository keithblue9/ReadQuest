export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-border"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${
          pct >= 100 ? "bg-success" : "bg-gradient-to-r from-primary to-accent"
        }`}
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
    </div>
  );
}
