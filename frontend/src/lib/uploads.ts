import { api } from "./api";
import { compressImage } from "./image";
import type { UploadedPhoto } from "./types";

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const blob = await compressImage(file);
  const form = new FormData();
  form.append("file", blob, "photo.jpg");
  return api<UploadedPhoto>("/uploads/photos", { method: "POST", body: form });
}
