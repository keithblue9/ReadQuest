import Link from "next/link";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-28 text-4xl",
};

/** Warna inisial stabil per nama (satu dari beberapa hue tenang). */
const TONES = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
];

function tone(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

type Props = {
  name: string;
  url: string | null;
  size?: keyof typeof SIZES;
  /** Bila diisi, avatar menjadi tautan ke profil publik. */
  userId?: string;
  ring?: boolean;
};

export function Avatar({ name, url, size = "md", userId, ring = false }: Props) {
  const cls = `${SIZES[size]} shrink-0 rounded-full object-cover ${ring ? "ring-4 ring-surface" : ""}`;
  const body = url ? (
    <img src={url} alt="" className={cls} />
  ) : (
    <span aria-hidden className={`${cls} grid place-items-center font-bold ${tone(name)}`}>
      {initials(name)}
    </span>
  );
  if (!userId) return body;
  return (
    <Link href={`/u/${userId}`} aria-label={`Profil ${name}`} className="shrink-0 rounded-full">
      {body}
    </Link>
  );
}
