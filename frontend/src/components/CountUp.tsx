"use client";

import { useEffect, useState } from "react";

/** Angka yang menghitung naik (mikro-animasi), menghormati prefers-reduced-motion. */
export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - start) / duration);
      setValue(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);
  return <>{value}</>;
}
