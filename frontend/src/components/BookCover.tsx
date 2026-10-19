const SIZES = {
  sm: { cls: "h-16 w-11 text-xs", w: 44, h: 64 },
  md: { cls: "h-24 w-16 text-xs", w: 64, h: 96 },
  lg: { cls: "h-40 w-[6.75rem] text-base", w: 108, h: 160 },
};

/** Warna sampul generatif: tinta tua yang tenang, stabil per judul. */
const SPINES = ["#1b2340", "#2a4a3f", "#5a2e2a", "#3b3355", "#2b4a66", "#5b4a1f", "#3a3f47"];

function spine(title: string) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SPINES[hash % SPINES.length];
}

export function BookCover({
  url,
  title,
  size = "md",
}: {
  url: string | null;
  title: string;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  // Rasio 2:3 dan dimensi eksplisit → tidak ada pergeseran layout saat gambar dimuat.
  const base = `${s.cls} relative shrink-0 overflow-hidden rounded-[4px] shadow-[0_2px_6px_rgb(0_0_0/0.22)]`;
  const spineShade = <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-black/20" />;
  if (url) {
    return (
      <span className={base}>
        <img
          src={url}
          alt={`Sampul ${title}`}
          width={s.w}
          height={s.h}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {spineShade}
      </span>
    );
  }
  return (
    <span className={`${base} flex flex-col justify-end p-1.5 pl-2.5`} style={{ background: spine(title) }} role="img" aria-label={`Sampul ${title}`}>
      <span aria-hidden className="mb-auto h-0.5 w-5 bg-white/70" />
      <span aria-hidden className="font-display line-clamp-4 leading-tight font-semibold text-white">
        {title}
      </span>
      {spineShade}
    </span>
  );
}
