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
      <div
        className="h-24 bg-ink sm:h-32 dark:bg-surface-muted"
        style={{ backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgb(255 255 255 / 0.07) 27px 28px)" }}
        aria-hidden
      />
      <div className="px-4 pb-4">
        <div className="-mt-12 flex flex-wrap items-end gap-x-4 gap-y-3 sm:-mt-14">
          <div className="relative">
            <Avatar name={name} url={avatarUrl} size="xl" ring />
            {avatarSlot}
          </div>
          {/* HP: nama mendapat baris sendiri agar tidak terpotong oleh tombol aksi. */}
          <div className="min-w-0 basis-full pb-1 sm:flex-1 sm:basis-auto">
            <h1 className="text-[26px] leading-tight break-words">{name}</h1>
            {headline && <p className="mt-0.5 text-[15px] text-muted">{headline}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 pb-1">{actions}</div>}
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
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-center sm:grid-cols-4">
          {[
            { icon: Clock, label: "Menit baca", value: stats.minutes },
            { icon: Library, label: "Buku selesai", value: stats.books },
            { icon: Flame, label: "Streak", value: stats.streak },
            { icon: Trophy, label: "Poin", value: stats.points },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col-reverse bg-surface px-2 py-3">
              <dt className="flex items-center justify-center gap-1 text-xs text-muted">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{value.toLocaleString("id-ID")}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
