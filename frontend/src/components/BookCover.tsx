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
      className={`${base} grid place-items-center bg-gradient-to-br from-primary/80 to-accent/80`}
      aria-label={`Sampul ${title}`}
      role="img"
    >
      <span aria-hidden>📘</span>
    </div>
  );
}
