"use client";

import { Camera, ImagePlus, X } from "lucide-react";

import { useRef, useState } from "react";

import { errorMessage } from "@/lib/errors";
import type { UploadedPhoto } from "@/lib/types";
import { uploadPhoto } from "@/lib/uploads";

type Props = {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  max?: number;
  label?: string;
  error?: string;
};

export function PhotoPicker({ photos, onChange, max = 4, label = "Foto buku", error }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = max - photos.length;
    const selected = Array.from(files).slice(0, room);
    setUploadError(null);
    setUploading((n) => n + selected.length);
    const uploaded: UploadedPhoto[] = [];
    for (const file of selected) {
      try {
        uploaded.push(await uploadPhoto(file));
      } catch (err) {
        setUploadError(errorMessage(err));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (uploaded.length) onChange([...photos, ...uploaded]);
  }

  const canAdd = photos.length + uploading < max;
  const message = uploadError ?? error;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.key} className="relative">
            <img src={photo.url} alt="" width={80} height={80} className="size-20 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((p) => p.key !== photo.key))}
              className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-ink text-paper ring-2 ring-surface"
              aria-label="Hapus foto"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`uploading-${i}`}
            className="grid size-20 place-items-center rounded-2xl border border-dashed border-border"
            aria-label="Mengunggah foto"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          </div>
        ))}
        {canAdd && (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface text-xs font-semibold text-muted transition hover:border-ink hover:text-ink"
            >
<Camera className="size-6" strokeWidth={1.8} aria-hidden />
              Kamera
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface text-xs font-semibold text-muted transition hover:border-ink hover:text-ink"
            >
<ImagePlus className="size-6" strokeWidth={1.8} aria-hidden />
              Galeri
            </button>
          </>
        )}
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        hidden
        data-testid="photo-gallery-input"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {message ? (
        <p className="text-sm text-danger" role="alert">
          {message}
        </p>
      ) : (
        <p className="text-xs text-muted">Foto diperkecil otomatis & metadata lokasi dihapus.</p>
      )}
    </div>
  );
}
