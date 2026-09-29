// Image upload rules (Part A, section 5): jpg, png or webp, up to 5 MB.
// The content type is taken from the file's magic bytes, not from the browser.

import type { ImageUpload } from "@/lib/data/repository";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export type ImageCheck = { ok: true; upload: ImageUpload } | { ok: false; error: string };

function sniff(bytes: Uint8Array): ImageUpload["contentType"] | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Client-side pre-check by declared type and size (the server re-checks the bytes). */
export function precheckImage(file: File): string | null {
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) return "Підтримуються лише JPG, PNG або WebP.";
  if (file.size > MAX_IMAGE_BYTES) return "Файл більший за 5 МБ.";
  return null;
}

export async function readImage(file: File): Promise<ImageCheck> {
  if (file.size === 0) return { ok: false, error: "Файл порожній." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Файл більший за 5 МБ." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniff(bytes);
  if (!contentType) return { ok: false, error: "Підтримуються лише JPG, PNG або WebP." };
  return { ok: true, upload: { bytes, contentType } };
}
