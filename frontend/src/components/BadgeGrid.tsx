import type { Badge } from "@/lib/types";

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {badges.map((b) => (
        <li
          key={b.id}
          className={`flex flex-col items-center rounded-2xl border p-3 text-center ${
            b.earned ? "border-accent/40 bg-accent/10" : "border-border bg-surface opacity-60"
          }`}
          title={b.description}
        >
          <span className={`text-3xl ${b.earned ? "" : "grayscale"}`} aria-hidden>
            {b.icon}
          </span>
          <span className="mt-1 text-xs font-bold leading-tight">{b.name}</span>
          <span className="mt-0.5 text-[11px] text-muted">
            {b.earned ? "Didapat" : `${Math.min(b.progress, b.target)}/${b.target}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
