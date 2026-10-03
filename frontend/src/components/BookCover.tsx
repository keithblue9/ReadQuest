const SIZES = {
  sm: "h-16 w-12 text-xl rounded-lg",
  md: "h-24 w-[4.5rem] text-3xl rounded-xl",
  lg: "h-40 w-28 text-5xl rounded-2xl",
};

export function BookCover({
  url,
  title,
  size = "md",
}: {
  url: string | null;
  title: string;
  size?: keyof typeof SIZES;
}) {
  const base = `${SIZES[size]} shrink-0 overflow-hidden border border-border shadow-sm`;
  if (url) {
    return <img src={url} alt={`Sampul ${title}`} className={`${base} object-cover`} loading="lazy" />;
  }
  return (
    <div
      className={`${base} grid place-items-center bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,black)] p-1 text-center`}
      aria-label={`Sampul ${title}`}
      role="img"
    >
      <span aria-hidden className="line-clamp-3 text-[0.55em] leading-tight font-bold text-white">
        {title}
      </span>
    </div>
  );
}
