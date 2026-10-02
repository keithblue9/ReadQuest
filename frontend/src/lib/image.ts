const MAX_DIMENSION = 1600;
const TARGET_BYTES = 900 * 1024; // di bawah batas server (~1MB)

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses foto"))),
      "image/jpeg",
      quality,
    ),
  );
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // imageOrientation menerapkan rotasi EXIF sebelum metadata dibuang.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Perkecil & kompres foto di perangkat (≤ ~1MB). Menggambar ulang ke canvas membuang seluruh
 * metadata EXIF (termasuk lokasi GPS).
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const source = await decode(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan foto");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  return blob;
}
