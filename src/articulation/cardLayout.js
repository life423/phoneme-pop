// The articulation card layout, in card pixels. Every card uses exactly these numbers, so the
// whole set reads as one designed series and the mouth photo is always in the same place.
export const CARD = { width: 1200, height: 1200, radius: 56 };
export const BANNER = { x: 30, y: 30, width: 1140, height: 230, radius: 54 };
export const PHOTO = { x: 40, y: 292, width: 760, height: 868, radius: 44, border: 8 };
export const COLUMN = { x: 840, width: 330 };
export const INSTRUCTION = { y: 300, height: 226 };
export const DIAGRAM = { x: 845, y: 548, size: 320, radius: 36, border: 7 };
export const SOUND = { y: 900, height: 256 };
export const PALETTE = { banner: '#A8D5DE', photoBorder: '#B9DFE6', ink: '#111827', paper: '#FFFFFF', edge: '#E2E8F0' };
export const FONT = `'Arial Rounded MT Bold', 'Nunito', 'Trebuchet MS', system-ui, sans-serif`;

// The mouth photograph inside its border: the predefined Magic Select region for every card,
// in picture pixels and the same { x, y, w, h, r } shape as picture pieces use.
export const MOUTH_REGION = {
  id: 'mouth',
  label: 'Mouth',
  x: PHOTO.x + PHOTO.border,
  y: PHOTO.y + PHOTO.border,
  w: PHOTO.width - 2 * PHOTO.border,
  h: PHOTO.height - 2 * PHOTO.border,
  r: PHOTO.radius - PHOTO.border,
};

// Wraps text into lines of at most `max` characters, keeping words whole.
export function wrap(text, max) {
  const lines = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && (last + ' ' + word).length <= max) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

// The biggest text size (from a few steps) whose wrapped lines fit a column area.
export function fitText(text, { width = COLUMN.width, height, sizes = [48, 44, 40, 36, 32] }) {
  for (const size of sizes) {
    const lines = wrap(text, Math.floor(width / (size * 0.56)));
    if (lines.length * size * 1.2 <= height) return { size, lines };
  }
  const size = sizes.at(-1);
  return { size, lines: wrap(text, Math.floor(width / (size * 0.56))) };
}

// Title size that fills the banner: big for short titles, smaller for long ones.
export const titleSize = (title) => Math.min(168, Math.floor(BANNER.width * 0.88 / (title.length * 0.6)));
