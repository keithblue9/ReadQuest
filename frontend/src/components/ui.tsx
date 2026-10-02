import { forwardRef, useId } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110"
      : "border border-border bg-surface text-foreground hover:bg-surface-muted";
  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...props}>
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
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
        className={`h-12 rounded-2xl border bg-surface px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
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

export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="animate-pop-in rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {children}
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground shadow-lg shadow-primary/30">
        📚
      </span>
      Read<span className="-ml-2 text-accent">Quest</span>
    </div>
  );
}

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Memuat">
      <span className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
