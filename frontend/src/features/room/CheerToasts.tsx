import { createPortal } from "react-dom";

import type { Cheer } from "./useReadingRoom";

export function CheerToasts({ cheers, myId }: { cheers: Cheer[]; myId?: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-40 flex flex-col items-center gap-2"
      aria-live="polite"
    >
      {cheers.map((c) => (
        <div
          key={c.id}
          className="animate-pop-in rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background shadow-lg"
        >
          <span className="mr-1 text-lg">{c.emoji}</span>
          {c.from}
          {c.to && c.to === myId ? " menyemangatimu!" : ""}
        </div>
      ))}
    </div>,
    document.body,
  );
}
