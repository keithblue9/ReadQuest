"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

export type FunctionOption = { id: string; name: string; parent_id: string | null };
type RegisterOptions = { functions: FunctionOption[]; open_login: boolean };

/** Pilihan fungsi + apakah mode masuk tanpa PIN aktif (publik, tanpa login). */
export function useRegisterOptions() {
  const [options, setOptions] = useState<RegisterOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<RegisterOptions>("/auth/register-options", { auth: false })
      .then(setOptions)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return {
    functions: options?.functions ?? null,
    openLogin: options?.open_login ?? false,
    loaded: options !== null,
    error,
  };
}
