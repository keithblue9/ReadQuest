import { ApiError } from "./api";

/** Pesan error per field dari respons validasi API (422). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const result: Record<string, string> = {};
  for (const field of error.fields) {
    const key = String(field.loc[field.loc.length - 1] ?? "");
    if (key && !result[key]) result[key] = field.message.replace(/^Value error, /, "");
  }
  return result;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Kamu sedang offline. Coba lagi saat koneksi kembali.";
  return "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
}
