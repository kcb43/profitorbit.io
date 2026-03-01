// ── URL validation ──────────────────────────────────────────────────────────
// Only returns strings that look like real network/blob/data URLs.
// Guards against photo IDs (bare UUIDs) being treated as fetchable URLs.
export function isValidImgUrl(s) {
  return (
    typeof s === 'string' &&
    (s.startsWith('http://') ||
      s.startsWith('https://') ||
      s.startsWith('blob:') ||
      s.startsWith('data:'))
  );
}

// Extract URL from various image object shapes used across the app.
export function getImgUrl(img) {
  if (!img) return null;
  if (typeof img === 'string') return isValidImgUrl(img) ? img : null;
  const url = img.imageUrl || img.url || img.image_url || img.preview || null;
  return isValidImgUrl(url) ? url : null;
}

// Fetch an image as a blob URL to avoid CORS canvas taint.
// Returns { blobUrl, cleanup } where cleanup revokes the URL.
export async function fetchImageAsBlob(imgUrl) {
  if (!imgUrl || !isValidImgUrl(imgUrl)) {
    throw new Error(`Invalid image URL: ${imgUrl}`);
  }
  const resp = await fetch(imgUrl);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  return {
    blobUrl,
    cleanup: () => URL.revokeObjectURL(blobUrl),
  };
}

// Load an image element from a URL, resolving when fully loaded.
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
