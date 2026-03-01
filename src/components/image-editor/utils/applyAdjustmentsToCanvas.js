import { isValidImgUrl } from './imageHelpers';

// ── Adapter: convert reducer state → canvas function input ──────────────────
// The canvas function uses FIE-style keys internally. This adapter translates
// from our clean reducer state shape.
export function stateToCanvasParams(imageState) {
  if (!imageState) return {};
  return {
    adjustments: {
      crop: imageState.crop?.croppedAreaPixels || null,
      rotation: imageState.rotation || 0,
      isFlippedX: imageState.flipH || false,
      isFlippedY: imageState.flipV || false,
    },
    finetunesProps: {
      gammaBrightness: imageState.finetune?.brightness ?? 0,
      contrast: imageState.finetune?.contrast ?? 0,
      shadowsValue: imageState.finetune?.shadows ?? 0,
    },
  };
}

// ── Canvas-based image processor ────────────────────────────────────────────
// Fetches the image as a blob first (avoids CORS canvas taint), then applies:
//   - Finetune adjustments (gamma brightness, contrast, shadows)
//   - Rotation / flip
//   - Crop (explicit pixel coordinates from react-easy-crop)
//   - Watermark text
// Returns a Promise<Blob>.
export async function applyAdjustmentsToCanvas(imgUrl, imageState = {}, watermarks = []) {
  if (!imgUrl || !isValidImgUrl(imgUrl)) {
    throw new Error(`Invalid image URL for canvas processing: ${imgUrl}`);
  }

  // Fetch as blob → object URL so the canvas is never cross-origin tainted
  let objectUrl = null;
  try {
    const resp = await fetch(imgUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    objectUrl = URL.createObjectURL(blob);
  } catch {
    objectUrl = imgUrl; // fallback: try direct URL
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const result = processImage(img, imageState, watermarks);
        if (objectUrl !== imgUrl) URL.revokeObjectURL(objectUrl);
        result.then(resolve, reject);
      } catch (err) {
        if (objectUrl !== imgUrl) URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      if (objectUrl !== imgUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${imgUrl}`));
    };

    if (objectUrl === imgUrl) img.crossOrigin = 'anonymous';
    img.src = objectUrl;
  });
}

function processImage(img, imageState, watermarks) {
  const crop = imageState.crop || {};
  const finetune = imageState.finetune || {};
  const rotation = imageState.rotation || 0;
  const flipH = imageState.flipH || false;
  const flipV = imageState.flipV || false;

  const gammaBrightness = finetune.brightness ?? 0;
  const contrast = finetune.contrast ?? 0;
  const shadowsVal = finetune.shadows ?? 0;

  // CSS filter for contrast
  const filterParts = [];
  if (contrast !== 0) filterParts.push(`contrast(${Math.max(0, 1 + contrast / 100)})`);

  // ── Crop coordinates ──────────────────────────────────────────────────
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  let srcX = 0, srcY = 0, srcW = w, srcH = h;

  // react-easy-crop provides croppedAreaPixels in source image coordinates
  const cropPixels = crop.croppedAreaPixels;
  if (cropPixels && cropPixels.width > 0 && cropPixels.height > 0) {
    srcX = Math.max(0, Math.round(cropPixels.x));
    srcY = Math.max(0, Math.round(cropPixels.y));
    srcW = Math.min(w - srcX, Math.round(cropPixels.width));
    srcH = Math.min(h - srcY, Math.round(cropPixels.height));
  } else if (crop.aspect && typeof crop.aspect === 'number') {
    // Ratio-only fallback for Apply to All (centered, maximum size)
    const imgRatio = w / h;
    if (imgRatio > crop.aspect) {
      srcH = h; srcW = Math.round(h * crop.aspect); srcX = Math.round((w - srcW) / 2);
    } else {
      srcW = w; srcH = Math.round(w / crop.aspect); srcY = Math.round((h - srcH) / 2);
    }
  }

  // ── Canvas setup ──────────────────────────────────────────────────────
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW * cos + srcH * sin);
  canvas.height = Math.round(srcW * sin + srcH * cos);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (filterParts.length) ctx.filter = filterParts.join(' ');

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (rotation) ctx.rotate(rad);
  if (flipH) ctx.scale(-1, 1);
  if (flipV) ctx.scale(1, -1);
  ctx.drawImage(img, srcX, srcY, srcW, srcH, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();

  // Reset filter before pixel operations
  ctx.filter = 'none';

  // ── Gamma brightness pixel pass ─────────────────────────────────────
  if (gammaBrightness !== 0) {
    const gamma = Math.pow(2, -gammaBrightness / 50);
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.pow(i / 255, gamma) * 255);
    const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = idata.data;
    for (let p = 0; p < px.length; p += 4) {
      px[p] = lut[px[p]];
      px[p + 1] = lut[px[p + 1]];
      px[p + 2] = lut[px[p + 2]];
    }
    ctx.putImageData(idata, 0, 0);
  }

  // ── Shadows pixel pass ──────────────────────────────────────────────
  if (shadowsVal !== 0) {
    const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = idata.data;
    for (let p = 0; p < px.length; p += 4) {
      const lum = (px[p] * 299 + px[p + 1] * 587 + px[p + 2] * 114) / 1000;
      const factor = Math.max(0, (192 - lum) / 192);
      if (factor < 0.01) continue;
      const adj = Math.round(shadowsVal * factor);
      px[p] = Math.min(255, Math.max(0, px[p] + adj));
      px[p + 1] = Math.min(255, Math.max(0, px[p + 1] + adj));
      px[p + 2] = Math.min(255, Math.max(0, px[p + 2] + adj));
    }
    ctx.putImageData(idata, 0, 0);
  }

  // ── Watermarks ──────────────────────────────────────────────────────
  if (watermarks.length > 0) {
    for (const wm of watermarks) {
      ctx.save();
      ctx.globalAlpha = wm.opacity ?? 1;
      ctx.font = `${wm.fontSize || 24}px ${wm.fontFamily || 'Arial'}`;
      ctx.fillStyle = wm.color || '#ffffff';
      // x, y are percentages of canvas dimensions
      const x = (wm.x / 100) * canvas.width;
      const y = (wm.y / 100) * canvas.height;
      ctx.fillText(wm.text || '', x, y);
      ctx.restore();
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.95
    );
  });
}
