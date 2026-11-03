"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Alert, Button, Field, INPUT_CLASS, Skeleton } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { PhoneField, PinField } from "@/features/auth/PinField";
import { type FunctionOption, useRegisterOptions } from "@/features/auth/useRegisterOptions";
import { useT } from "@/features/ui-config/store";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { detectTimezone } from "@/lib/platform";

export default function RegisterPage() {
  const { register, quickRegister } = useAuth();
  const t = useT();
  const { functions, openLogin, loaded, error: optionsError } = useRegisterOptions();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const base = {
      name: String(form.get("name")),
      function_id: String(form.get("function_id") ?? ""),
      timezone: detectTimezone(),
    };
    setPending(true);
    setError(null);
    setErrors({});
    try {
      if (openLogin) await quickRegister(base);
      else await register({ ...base, phone: String(form.get("phone")), pin: String(form.get("pin")) });
    } catch (err) {
      const perField = fieldErrors(err);
      setErrors(perField);
      setError(Object.keys(perField).length ? t("auth.register.check_fields") : errorMessage(err));
      setPending(false);
    }
  }

  if (!loaded && !optionsError) {
    return (
      <div aria-busy="true" aria-label="Memuat">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="mt-3 h-5 w-3/4" />
        <Skeleton className="mt-8 h-12 w-full rounded-xl" />
        <Skeleton className="mt-4 h-12 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-[30px] leading-tight">{t(openLogin ? "auth.quick.title" : "auth.register.title")}</h1>
      <p className="mt-2 text-muted">{t(openLogin ? "auth.quick.subtitle" : "auth.register.subtitle")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {(error || optionsError) && <Alert>{error ?? optionsError}</Alert>}
        <Field label={t("auth.register.name")} name="name" autoComplete="name" error={errors.name} required />
        <FunctionSelect functions={functions} invalid={!!errors.function_id} />
        {!openLogin && (
          <>
            <PhoneField error={errors.phone} />
            <PinField autoComplete="new-password" error={errors.pin} hint={t("auth.register.pin_hint")} />
          </>
        )}
        <Button type="submit" loading={pending} className="mt-2">
          {t("auth.register.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {openLogin ? null : <>{t("auth.register.has_account")} </>}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          {t(openLogin ? "auth.quick.back" : "auth.register.login_link")}
        </Link>
      </p>
    </div>
  );
}

function FunctionSelect({ functions, invalid }: { functions: FunctionOption[] | null; invalid: boolean }) {
  const t = useT();
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {t("auth.register.function")}
      </label>
      <select
        id={id}
        name="function_id"
        defaultValue=""
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={`${INPUT_CLASS} ${invalid ? "border-danger" : "border-line"}`}
      >
        <option value="" disabled>
          {functions ? t("auth.register.function_placeholder") : "…"}
        </option>
        {functions?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      {invalid && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {t("auth.register.function_error")}
        </p>
      )}
    </div>
  );
}
