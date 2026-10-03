"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { PhoneField, PinField } from "@/features/auth/PinField";
import { useT } from "@/features/ui-config/store";
import { errorMessage, fieldErrors } from "@/lib/errors";

export default function LoginPage() {
  const { login } = useAuth();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setErrors({});
    try {
      await login(String(form.get("phone")), String(form.get("pin")));
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-3xl font-extrabold">{t("auth.login.title")}</h1>
      <p className="mt-2 text-muted">{t("auth.login.subtitle")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <PhoneField error={errors.phone} />
        <PinField autoComplete="current-password" error={errors.pin} />
        <Button type="submit" loading={pending} className="mt-2">
          {t("auth.login.submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">{t("auth.login.forgot_pin")}</p>
      <p className="mt-2 text-center text-sm text-muted">
        {t("auth.login.no_account")}{" "}
        <Link href="/register" className="font-bold text-primary">
          {t("auth.login.register_link")}
        </Link>
      </p>
    </div>
  );
}
