import imageCompression from "browser-image-compression";

import {
  LISTING_MAX_FILE_SIZE_MB,
} from "@/utils/imageUploadStandards";

const DEFAULT_OPTIONS = {
  // We keep these conservative to avoid hurting quality too much while still shrinking huge phone photos.
  maxSizeMB: 2.5,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
};

function isHeicLike(file) {
  const t = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return t === "image/heic" || t === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

function isWebpLike(file) {
  const t = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return t === "image/webp" || name.endsWith(".webp");
}

async function convertHeicToJpeg(file) {
  // Dynamic import to keep initial bundle smaller.
  const mod = await import("heic2any");
  const heic2any = mod?.default || mod;
  if (typeof heic2any !== "function") {
    throw new Error("HEIC converter not available");
  }

  const outBlob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  const blob = Array.isArray(outBlob) ? outBlob[0] : outBlob;
  if (!blob) throw new Error("HEIC conversion failed");

  const baseName = String(file?.name || "photo").replace(/\.(heic|heif)$/i, "");
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function convertWebpToJpeg(file) {
  // Use canvas-based conversion (works in modern browsers). If it fails, we keep the original.
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = blobUrl;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });

    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (!w || !h) throw new Error("Invalid WebP image dimensions");

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");

    // WebP may have transparency; JPEG does not. Fill with white first.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const outBlob = await new Promise((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        "image/jpeg",
        0.92
      );
    });
    if (!outBlob) throw new Error("WebP conversion failed");

    const baseName = String(file?.name || "photo").replace(/\.webp$/i, "");
    return new File([outBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Standardize listing images before upload:
 * - Convert HEIC/HEIF to JPEG (best-effort)
 * - Convert WebP to JPEG for maximum marketplace compatibility (best-effort)
 * - Compress oversized photos so uploads are fast and consistent
 */
export async function standardizeImageForUpload(file, options = {}) {
  if (!(file instanceof File)) return file;
  const type = String(file.type || "");
  if (!type.startsWith("image/")) return file;

  const maxMb = typeof options.maxFileSizeMb === "number" ? options.maxFileSizeMb : LISTING_MAX_FILE_SIZE_MB;
  const maxBytes = maxMb * 1024 * 1024;

  let working = file;
  if (isWebpLike(working)) {
    try {
      working = await convertWebpToJpeg(working);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("WebP conversion failed; uploading original file", e);
    }
  }
  if (isHeicLike(working)) {
    try {
      working = await convertHeicToJpeg(working);
    } catch (e) {
      // If conversion fails (browser limitations), keep original and let existing flows handle it.
      // The UI/FAQ will advise users to use JPG/PNG if issues occur.
      // eslint-disable-next-line no-console
      console.warn("HEIC conversion failed; uploading original file", e);
    }
  }

  // Compress if too large or if the caller explicitly requests it.
  const shouldCompress = working.size > maxBytes || options.forceCompress === true;
  if (!shouldCompress) return working;

  const compressionOptions = {
    ...DEFAULT_OPTIONS,
    ...(options.compressionOptions || {}),
    // Ensure we never try to keep a file larger than the per-photo limit.
    maxSizeMB: Math.min(DEFAULT_OPTIONS.maxSizeMB, maxMb),
  };

  try {
    return await imageCompression(working, compressionOptions);
  } catch (e) {
    // If compression fails, return original; upload route may still accept.
    // eslint-disable-next-line no-console
    console.warn("Image compression failed; uploading original file", e);
    return working;
  }
}

