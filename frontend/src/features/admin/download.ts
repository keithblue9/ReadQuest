import { apiBlob } from "@/lib/api";

/** Unduh berkas dari endpoint terautentikasi (Bearer token tidak bisa lewat <a href>). */
export async function downloadFile(path: string, filename: string) {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
