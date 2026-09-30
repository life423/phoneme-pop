import { findRegions } from './regions.js';

// Pictures for Magic Select: shrinking an image before it's sent, where it lives for the
// session, and the parts Magic Select can lift out of it (worked out in this browser).

export const newPictureId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

export const pictureUrl = (code, id) => `/api/rooms/${code}/pictures/${id}`;

const MAX_SIDE = 1600;
const ANALYSIS_SIDE = 400;

// A copy at most 1600px on its long side, as a JPEG on white (worksheets are white paper anyway).
export async function shrinkPicture(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('This picture could not be shrunk');
  return { blob, w, h };
}

const found = new Map(); // picture address -> promise of its regions

// The parts of a picture Magic Select can lift out, in the picture's own pixels. Found once
// per picture on a small copy (about a tenth of a second), with a pixel of margin kept.
export function pictureRegions(src, pic) {
  if (!found.has(src)) {
    const work = (async () => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = Math.min(1, ANALYSIS_SIDE / Math.max(pic.w, pic.h));
      const w = Math.max(1, Math.round(pic.w * scale));
      const h = Math.max(1, Math.round(pic.h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const kx = pic.w / w;
      const ky = pic.h / h;
      return findRegions(ctx.getImageData(0, 0, w, h)).map((r) => {
        const x = Math.max(0, Math.floor((r.x - 0.5) * kx));
        const y = Math.max(0, Math.floor((r.y - 0.5) * ky));
        return {
          kind: r.kind,
          x,
          y,
          w: Math.min(pic.w - x, Math.ceil((r.w + 1) * kx)),
          h: Math.min(pic.h - y, Math.ceil((r.h + 1) * ky)),
          r: Math.round(r.radius * kx),
        };
      });
    })().catch(() => []);
    found.set(src, work);
  }
  return found.get(src);
}
