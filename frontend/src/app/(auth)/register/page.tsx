"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { PhoneField, PinField } from "@/features/auth/PinField";
import { useT } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { detectTimezone } from "@/lib/platform";

type FunctionOption = { id: string; name: string; parent_id: string | null };

export default function RegisterPage() {
  const { register } = useAuth();
  const t = useT();
  const selectId = useId();
  const [functions, setFunctions] = useState<FunctionOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<{ functions: FunctionOption[] }>("/auth/register-options", { auth: false })
      .then((r) => setFunctions(r.functions))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setErrors({});
    try {
      await register({
        name: String(form.get("name")),
        function_id: String(form.get("function_id") ?? ""),
        phone: String(form.get("phone")),
        pin: String(form.get("pin")),
        timezone: detectTimezone(),
      });
    } catch (err) {
      const perField = fieldErrors(err);
      setErrors(perField);
      setError(Object.keys(perField).length ? t("auth.register.check_fields") : errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-3xl font-bold">{t("auth.register.title")}</h1>
      <p className="mt-2 text-muted">{t("auth.register.subtitle")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t("auth.register.name")} name="name" autoComplete="name" error={errors.name} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-semibold">
            {t("auth.register.function")}
          </label>
          <select
            id={selectId}
            name="function_id"
            defaultValue=""
            required
            aria-invalid={errors.function_id ? true : undefined}
            className={`h-12 rounded-2xl border bg-surface px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 ${
              errors.function_id ? "border-danger" : "border-border"
            }`}
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
          {errors.function_id && <p className="text-sm text-danger">{t("auth.register.function_error")}</p>}
        </div>
        <PhoneField error={errors.phone} />
        <PinField
          autoComplete="new-password"
          error={errors.pin}
          hint={t("auth.register.pin_hint")}
        />
        <Button type="submit" loading={pending} className="mt-2">
          {t("auth.register.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.register.has_account")}{" "}
        <Link href="/login" className="font-bold text-primary">
          {t("auth.register.login_link")}
        </Link>
      </p>
    </div>
  );
}
