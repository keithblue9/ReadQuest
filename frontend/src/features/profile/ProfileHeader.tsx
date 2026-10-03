import { Briefcase, CalendarDays, Clock, Flame, Library, Trophy } from "lucide-react";

import { Avatar } from "@/components/Avatar";

type Props = {
  name: string;
  avatarUrl: string | null;
  headline: string;
  fn: string | null;
  role: string | null;
  joinedAt: string | null;
  levelTitle?: string | null;
  stats: { minutes: number; books: number; streak: number; points: number };
  actions?: React.ReactNode;
  avatarSlot?: React.ReactNode;
};

/** Header profil bergaya media sosial: sampul, foto besar, nama, headline, dan angka utama. */
export function ProfileHeader({ name, avatarUrl, headline, fn, role, joinedAt, levelTitle, stats, actions, avatarSlot }: Props) {
  const joined = joinedAt ? new Date(joinedAt).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : null;
  return (
    <section className="card overflow-hidden">
      <div className="h-28 bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_55%,#0f766e)] sm:h-40" aria-hidden />
      <div className="px-4 pb-4">
        <div className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-16">
          <div className="relative">
            <Avatar name={name} url={avatarUrl} size="xl" ring />
            {avatarSlot}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-2xl font-bold">{name}</h1>
            {headline && <p className="text-[15px]">{headline}</p>}
          </div>
          {actions && <div className="flex gap-2 pb-1">{actions}</div>}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {(fn || role) && (
            <span className="flex items-center gap-1.5">
              <Briefcase className="size-4" aria-hidden />
              {[fn, role].filter(Boolean).join(" · ")}
            </span>
          )}
          {levelTitle && (
            <span className="flex items-center gap-1.5">
              <Trophy className="size-4" aria-hidden />
              {levelTitle}
            </span>
          )}
          {joined && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              Bergabung {joined}
            </span>
          )}
        </p>
        <dl className="mt-4 grid grid-cols-4 divide-x divide-border rounded-lg border border-border text-center">
          {[
            { icon: Clock, label: "Menit baca", value: stats.minutes },
            { icon: Library, label: "Buku selesai", value: stats.books },
            { icon: Flame, label: "Streak", value: stats.streak },
            { icon: Trophy, label: "Poin", value: stats.points },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="px-1 py-2.5">
              <dd className="text-lg font-bold tabular-nums">{value.toLocaleString("id-ID")}</dd>
              <dt className="flex items-center justify-center gap-1 text-[11px] text-muted">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
