"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button, Skeleton } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { MemberPicker } from "@/features/auth/MemberPicker";
import { PhoneField, PinField } from "@/features/auth/PinField";
import { useRegisterOptions } from "@/features/auth/useRegisterOptions";
import { useT } from "@/features/ui-config/store";
import { errorMessage, fieldErrors } from "@/lib/errors";

export default function LoginPage() {
  const t = useT();
  const { openLogin, loaded } = useRegisterOptions();

  if (!loaded) {
    return (
      <div aria-busy="true" aria-label="Memuat">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
        <Skeleton className="mt-8 h-12 w-full rounded-xl" />
        <Skeleton className="mt-3 h-16 w-full rounded-xl" />
        <Skeleton className="mt-2 h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (!openLogin) return <PinLogin />;

  return (
    <div className="animate-pop-in">
      <h1 className="text-[30px] leading-tight">{t("auth.pick.title")}</h1>
      <p className="mt-2 text-muted">{t("auth.pick.subtitle")}</p>
      <div className="mt-6">
        <MemberPicker />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        {t("auth.pick.not_listed")}{" "}
        <Link href="/register" className="font-semibold text-ink underline underline-offset-2">
          {t("auth.pick.add_me")}
        </Link>
      </p>
      <details className="group mt-6 border-t border-line pt-4">
        <summary className="flex min-h-11 cursor-pointer items-center justify-center text-sm font-semibold text-muted hover:text-ink">
          {t("auth.pick.use_pin")}
        </summary>
        <div className="pt-2">
          <PinForm />
        </div>
      </details>
    </div>
  );
}

function PinLogin() {
  const t = useT();
  return (
    <div className="animate-pop-in">
      <h1 className="text-[30px] leading-tight">{t("auth.login.title")}</h1>
      <p className="mt-2 text-muted">{t("auth.login.subtitle")}</p>
      <div className="mt-8">
        <PinForm />
      </div>
      <p className="mt-4 text-center text-sm text-muted">{t("auth.login.forgot_pin")}</p>
      <p className="mt-2 text-center text-sm text-muted">
        {t("auth.login.no_account")}{" "}
        <Link href="/register" className="font-semibold text-ink underline underline-offset-2">
          {t("auth.login.register_link")}
        </Link>
      </p>
    </div>
  );
}

function PinForm() {
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <PhoneField error={errors.phone} />
      <PinField autoComplete="current-password" error={errors.pin} />
      <Button type="submit" loading={pending} className="mt-2">
        {t("auth.login.submit")}
      </Button>
    </form>
  );
}
