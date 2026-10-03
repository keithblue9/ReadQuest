"use client";

import { useEffect, useState } from "react";

import { useUiConfig } from "./store";

/**
 * Background halaman login (desktop): slideshow crossfade dari gambar yang diunggah Admin,
 * dengan durasi per gambar dari Admin → Tampilan. Tanpa gambar: gradien bawaan.
 * Hanya gambar aktif, sebelumnya, dan berikutnya yang dimuat agar ringan.
 */
export function LoginBackdrop() {
  const { login, branding } = useUiConfig();
  return (
    <Slideshow slides={login.backgrounds} intervalSeconds={login.interval_seconds} emoji={branding.logo_emoji} />
  );
}

type SlideshowProps = {
  slides: { key: string; url: string }[];
  intervalSeconds: number;
  emoji: string;
};

/** Slideshow crossfade; juga dipakai sebagai pratinjau di Admin → Tampilan. */
export function Slideshow({ slides, intervalSeconds, emoji }: SlideshowProps) {
  const [tick, setTick] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, intervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [count, intervalSeconds]);

  const current = count ? tick % count : 0;

  return (
    <div className="absolute inset-0 overflow-hidden bg-primary" aria-hidden>
      {count === 0 ? (
        <div className="login-gradient absolute inset-0">
          <div className="absolute right-[8%] bottom-[10%] text-[10rem] leading-none opacity-20 select-none">
            {emoji}
          </div>
        </div>
      ) : (
        slides.map((slide, i) => {
          const near = i === current || i === (current + 1) % count || i === (current - 1 + count) % count;
          if (!near) return null;
          return (
            <img
              key={slide.key}
              src={slide.url}
              alt=""
              className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
                i === current ? "opacity-100" : "opacity-0"
              }`}
            />
          );
        })
      )}
      {count > 1 && (
        <div className="absolute right-4 bottom-4 flex gap-1.5">
          {slides.map((slide, i) => (
            <span
              key={slide.key}
              className={`h-1.5 rounded-full bg-white/90 shadow transition-all ${i === current ? "w-6" : "w-1.5 opacity-60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
