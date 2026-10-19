import Link from "next/link";

const SIZES = {
  xs: "size-6 text-[0.75rem] tracking-tight",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-28 text-4xl",
};
const PX = { xs: 24, sm: 32, md: 40, lg: 64, xl: 112 };

/** Warna inisial stabil per nama: nada kertas/tinta yang tenang (semua ≥4.5:1). */
const TONES = [
  "bg-[#e6e9f3] text-[#1b2340] dark:bg-[#2b3460] dark:text-[#e6e9f3]",
  "bg-[#e3efe8] text-[#1f5a40] dark:bg-[#1f4535] dark:text-[#d5efe1]",
  "bg-[#f3e9d6] text-[#6b4a00] dark:bg-[#4a3a17] dark:text-[#f6e3b8]",
  "bg-[#f1e4e2] text-[#7a2e24] dark:bg-[#4f2a27] dark:text-[#f6d9d4]",
  "bg-[#e9e5f2] text-[#3f3466] dark:bg-[#3a3360] dark:text-[#e5e0f6]",
  "bg-[#e4ecf2] text-[#244a66] dark:bg-[#22405a] dark:text-[#d8e8f4]",
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
    <img src={url} alt="" width={PX[size]} height={PX[size]} decoding="async" className={cls} />
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
