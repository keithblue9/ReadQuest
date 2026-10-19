"use client";

import { forwardRef, useId, useRef } from "react";

export { Logo } from "./Logo";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  loading?: boolean;
};

export const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100";

export const BUTTON_VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--paper))]",
  secondary: "bg-highlight text-on-highlight hover:brightness-95",
  ghost: "border border-line bg-surface text-ink hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-110 dark:text-[#121830]",
} as const;

export const BUTTON_SIZES = { md: "h-12 px-5 text-[15px]", sm: "h-11 px-4 text-sm" } as const;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  // Lebar penuh secara default, kecuali className menentukan lebar sendiri (mis. `w-auto`).
  const width = /(^|\s)w-/.test(className) ? "" : "w-full";
  return (
    <button
      className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${width} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const INPUT_CLASS =
  "h-12 w-full rounded-xl border bg-surface px-4 text-base text-ink placeholder:text-muted/80 transition focus:border-ink focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-highlight/60 disabled:cursor-not-allowed disabled:bg-surface-muted";

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className = "", ...props },
  ref,
) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT_CLASS} ${error ? "border-danger" : "border-line"} ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Alert({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "info" }) {
  const styles =
    tone === "danger"
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-line bg-surface-muted text-ink";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`animate-pop-in rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Memuat">
      <span className="h-3 w-24 overflow-hidden rounded-[3px] bg-line" aria-hidden>
        <span className="block h-full w-1/2 animate-pulse rounded-[3px] bg-highlight" />
      </span>
    </div>
  );
}

/** Placeholder dengan ukuran tetap agar layout tidak melompat saat data datang. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none ${className}`} />;
}

/** Keadaan kosong yang selalu mengarahkan ke tindakan berikutnya. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col items-center gap-2 px-6 py-10 text-center ${className}`}>
      {icon && <span className="mb-1 grid size-12 place-items-center rounded-full bg-surface-muted text-ink" aria-hidden>{icon}</span>}
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="max-w-[46ch] text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export type TabItem<T extends string> = { value: T; label: React.ReactNode; count?: number };

/**
 * Tablist dengan roving tabindex (panah kiri/kanan, Home/End). Tab aktif ditandai stabilo.
 * Isinya hanya tab — kontrol lain (select, tombol) letakkan di luar komponen ini.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
  variant = "underline",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  variant?: "underline" | "pill";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const found = items.findIndex((i) => i.value === value);
  const idx = Math.max(0, found);
  function move(to: number) {
    const n = (to + items.length) % items.length;
    refs.current[n]?.focus();
    onChange(items[n].value);
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 overflow-x-auto [scrollbar-width:none] ${variant === "underline" ? "border-b border-line" : ""} ${className}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(idx + 1);
        else if (e.key === "ArrowLeft") move(idx - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(items.length - 1);
        else return;
        e.preventDefault();
      }}
    >
      {items.map((item, i) => {
        const active = item.value === value;
        const style =
          variant === "underline"
            ? `relative h-11 px-3 text-sm font-semibold ${active ? "text-ink" : "text-muted hover:text-ink"}`
            : `h-10 rounded-full px-4 text-sm font-semibold ${active ? "bg-ink text-paper dark:bg-highlight dark:text-on-highlight" : "bg-surface-muted text-ink hover:brightness-95"}`;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active || (found < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={`shrink-0 whitespace-nowrap transition ${style}`}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 text-xs text-muted tabular-nums">{item.count}</span>}
            {variant === "underline" && active && (
              <span aria-hidden className="marker-fill absolute inset-x-2 bottom-1.5 -z-0 h-2 rounded-[2px] bg-highlight/80 mix-blend-multiply dark:mix-blend-normal dark:h-0.5 dark:bottom-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
