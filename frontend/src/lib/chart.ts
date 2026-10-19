const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Batas atas sumbu yang "bulat" (mis. 201 → 250) agar gridline mudah dibaca. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = STEPS.find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}
