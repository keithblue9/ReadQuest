"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  api,
  NetworkError,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from "@/lib/api";
import type { Me, TokenResponse } from "@/lib/types";

/** `offline`: sesi belum bisa dipulihkan karena server tidak terjangkau (bukan logout). */
type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "offline";

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  invite_code: string;
  timezone: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: Me | null;
  login: (email: string, password: string) => Promise<Me>;
  register: (input: RegisterInput) => Promise<Me>;
  logout: () => Promise<void>;
  setUser: (user: Me) => void;
  refreshUser: () => Promise<void>;
  /** Coba pulihkan sesi lagi (dipakai layar offline). */
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applySession = useCallback((data: TokenResponse) => {
    setAccessToken(data.access_token);
    setUserState(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus("unauthenticated");
  }, []);

  const restore = useCallback(
    () =>
      refreshSession().then(
        (data) => (data ? applySession(data) : clearSession()),
        (err) => {
          if (err instanceof NetworkError) setStatus("offline");
          else clearSession();
        },
      ),
    [applySession, clearSession],
  );

  // Saat halaman dimuat, pulihkan sesi dari refresh cookie.
  useEffect(() => {
    restore();
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(null);
  }, [restore, clearSession]);

  // Offline saat membuka aplikasi: coba lagi otomatis begitu koneksi kembali.
  useEffect(() => {
    if (status !== "offline") return;
    const onOnline = () => restore();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status, restore]);

  const retry = useCallback(() => {
    setStatus("loading");
    restore();
  }, [restore]);

  const login = useCallback(
    async (email: string, password: string) =>
      applySession(
        await api<TokenResponse>("/auth/login", {
          method: "POST",
          json: { email, password },
          auth: false,
        }),
      ),
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      applySession(
        await api<TokenResponse>("/auth/register", { method: "POST", json: input, auth: false }),
      ),
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api<void>("/auth/logout", { method: "POST", auth: false });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const setUser = useCallback((next: Me) => setUserState(next), []);

  const refreshUser = useCallback(async () => {
    try {
      setUserState(await api<Me>("/me"));
    } catch {
      // tetap pakai data lama
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, setUser, refreshUser, retry }),
    [status, user, login, register, logout, setUser, refreshUser, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return context;
}
