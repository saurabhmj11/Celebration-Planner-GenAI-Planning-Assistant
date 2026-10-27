/**
 * Browser-side photo intake pipeline for the Event Photo Memory Wall.
 *
 * Uploaded files are downscaled + re-encoded BEFORE they ever touch app state:
 * a 12-megapixel phone shot (~4MB) becomes a ~720px JPEG (~60–180KB), which
 * is what keeps dozens of photos inside the ~5MB localStorage budget.
 *
 * Pure validation lives in src/lib/photos/photoModel.js (bun-testable);
 * everything here needs a DOM (Image, canvas, FileReader) and therefore has
 * no unit tests by design — the model + UI-level E2E cover the outcomes.
 */

import { MAX_PHOTO_DATAURL_CHARS, validatePhotoDataUrl } from '../lib/photos/photoModel';

/** Downscale target: longest edge of the stored photo. */
export const PHOTO_MAX_DIMENSION = 720;

/** JPEG quality for re-encoding (0.72 ≈ 60–180KB at 720px). */
export const PHOTO_JPEG_QUALITY = 0.72;

/** Reject absurdly large uploads before decoding them. */
export const PHOTO_MAX_FILE_BYTES = 12 * 1024 * 1024;

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Read one File into a downscaled JPEG data URL.
 * Resolves null for anything that failed validation or decoding.
 * @returns {Promise<string|null>}
 */
export function processImageFile(file, { maxDim = PHOTO_MAX_DIMENSION, quality = PHOTO_JPEG_QUALITY } = {}) {
  return new Promise((resolve) => {
    if (!file || typeof document === 'undefined') {
      resolve(null);
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type) || file.size > PHOTO_MAX_FILE_BYTES) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const w = Math.max(1, Math.round((img.naturalWidth || maxDim) * scale));
          const h = Math.max(1, Math.round((img.naturalHeight || maxDim) * scale));

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          // White matte so transparent PNGs don't turn black under JPEG.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length > MAX_PHOTO_DATAURL_CHARS && quality > 0.5) {
            // One graceful step down before giving up on a huge shot.
            dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.45, quality - 0.2));
          }
          resolve(validatePhotoDataUrl(dataUrl) ? dataUrl : null);
        } catch {
          resolve(null);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Process a batch of files sequentially (canvas work is heavy; sequential
 * keeps the UI responsive and the photo order predictable).
 * @returns {Promise<{ dataUrls: string[], rejected: number }>}
 */
export async function processImageFiles(files, opts) {
  const list = Array.from(files || []);
  const dataUrls = [];
  let rejected = 0;

  for (const file of list) {
    const url = await processImageFile(file, opts);
    if (url) dataUrls.push(url);
    else rejected++;
  }

  return { dataUrls, rejected };
}
