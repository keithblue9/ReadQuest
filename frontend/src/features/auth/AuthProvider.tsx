"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  api,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from "@/lib/api";
import type { Me, TokenResponse } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

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

  // Saat halaman dimuat, pulihkan sesi dari refresh cookie.
  useEffect(() => {
    let cancelled = false;
    refreshSession().then((data) => {
      if (cancelled) return;
      if (data) applySession(data);
      else clearSession();
    });
    setSessionExpiredHandler(clearSession);
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, [applySession, clearSession]);

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

  const value = useMemo(
    () => ({ status, user, login, register, logout, setUser }),
    [status, user, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return context;
}
