import type { TokenResponse } from "./types";

export const API_BASE = "/api/v1";

export type FieldError = { loc: (string | number)[]; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: FieldError[] = [],
  ) {
    super(message);
  }
}

// Access token hanya disimpan di memori (bukan localStorage) untuk mengurangi risiko XSS.
// Refresh token ada di cookie httpOnly yang dikelola browser.
let accessToken: string | null = null;
let refreshInFlight: Promise<TokenResponse | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; fields?: FieldError[] } } = {};
  try {
    body = await response.json();
  } catch {
    // respons tanpa body JSON
  }
  return new ApiError(
    response.status,
    body.error?.code ?? "http_error",
    body.error?.message ?? "Terjadi kesalahan, coba lagi",
    body.error?.fields ?? [],
  );
}

/** Tukar refresh cookie dengan access token baru. Panggilan bersamaan berbagi satu request. */
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) {
          setAccessToken(null);
          return null;
        }
        const data = (await response.json()) as TokenResponse;
        setAccessToken(data.access_token);
        return data;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: BodyInit;
  auth?: boolean;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, body, auth = true, headers, ...init } = options;

  const send = () => {
    const finalHeaders = new Headers(headers);
    if (json !== undefined) finalHeaders.set("Content-Type", "application/json");
    if (auth && accessToken) finalHeaders.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  };

  let response = await send();
  if (response.status === 401 && auth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send();
    } else {
      onSessionExpired?.();
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
