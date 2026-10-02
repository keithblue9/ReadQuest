import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, refreshSession, setAccessToken, setSessionExpiredHandler } from "./api";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const tokenResponse = (token: string) => ({
  access_token: token,
  token_type: "bearer",
  expires_in: 900,
  user: { id: "1" },
});

describe("api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("old-token");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    setSessionExpiredHandler(null);
  });

  it("mengirim bearer token dan body JSON", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await api("/me", { method: "PATCH", json: { name: "A" } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/me");
    expect(init.headers.get("Authorization")).toBe("Bearer old-token");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "A" }));
  });

  it("refresh token sekali saat 401 lalu mengulang request", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "token_invalid", message: "x" } }))
      .mockResolvedValueOnce(json(200, tokenResponse("new-token")))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(api("/me")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.get("Authorization")).toBe("Bearer new-token");
  });

  it("memanggil handler sesi berakhir bila refresh gagal", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "token_invalid", message: "x" } }))
      .mockResolvedValueOnce(json(401, { error: { code: "refresh_invalid", message: "x" } }));

    await expect(api("/me")).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("refresh bersamaan hanya mengirim satu request", async () => {
    fetchMock.mockResolvedValue(json(200, tokenResponse("t")));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mengubah error API menjadi ApiError dengan detail field", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        error: {
          code: "validation_error",
          message: "Data tidak valid",
          fields: [{ loc: ["password"], message: "terlalu pendek" }],
        },
      }),
    );
    const error = (await api("/auth/register", { auth: false }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fields[0].loc).toEqual(["password"]);
  });
});
