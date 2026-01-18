export const LISTING_MAX_PHOTOS = 25;
export const LISTING_MAX_FILE_SIZE_MB = 15;

export const LISTING_ALLOWED_FORMATS_LABEL = "JPG, PNG, HEIC/HEIF, WebP";
export const LISTING_DISALLOWED_LABEL = "No PDFs.";

export function listingUploadHintText() {
  return `Up to ${LISTING_MAX_PHOTOS} photos, ${LISTING_MAX_FILE_SIZE_MB}MB per photo. Supported: ${LISTING_ALLOWED_FORMATS_LABEL}. WebP/HEIC are auto-converted to JPG for compatibility. ${LISTING_DISALLOWED_LABEL}`;
}

