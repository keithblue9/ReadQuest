"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { errorMessage } from "@/lib/errors";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(form.get("email")), String(form.get("password")));
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-3xl font-extrabold">Selamat datang kembali 👋</h1>
      <p className="mt-2 text-muted">Lanjutkan petualangan bacamu hari ini.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" loading={pending} className="mt-2">
          Masuk
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Punya kode undangan?{" "}
        <Link href="/register" className="font-bold text-primary">
          Daftar di sini
        </Link>
      </p>
    </div>
  );
}
