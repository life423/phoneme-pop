import { BOARD, STAGE } from './stage.js';

export const INK = { tutor: '#2563eb', student: '#111827' };
export const PEN_WIDTH = 6;
export const ERASER_WIDTH = 44;
export const MAX_STROKE_NUMBERS = 8000; // matches the server's cap (4,000 points)

// Everything on the whiteboard is a stroke: pen ink or an eraser path. Replaying
// them in the server's order (each eraser cuts through whatever came before it)
// rebuilds the board exactly, so undo, clear and restore are just list edits.
export class Board {
  constructor() {
    this.strokes = [];
    this.byId = new Map();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    for (const listener of this.listeners) listener(event);
  }

  add({ id, by, tool, pts, seq }) {
    if (this.byId.has(id)) return;
    const stroke = { id, by, tool, pts: [...pts], seq, done: false };
    this.byId.set(id, stroke);
    this.strokes.push(stroke);
    this.sort();
    this.emit({ type: 'segment', stroke, from: 0 });
  }

  append(id, pts) {
    const stroke = this.byId.get(id);
    if (!stroke || stroke.done || !Array.isArray(pts)) return;
    const from = stroke.pts.length;
    for (const n of pts) stroke.pts.push(n);
    this.emit({ type: 'segment', stroke, from });
  }

  finish(id) {
    const stroke = this.byId.get(id);
    if (!stroke) return;
    stroke.done = true;
    this.emit({ type: 'redraw' });
  }

  setSeq(id, seq) {
    const stroke = this.byId.get(id);
    if (!stroke) return;
    stroke.seq = seq;
    this.sort();
  }

  remove(id) {
    const stroke = this.byId.get(id);
    if (!stroke) return;
    this.byId.delete(id);
    this.strokes = this.strokes.filter((s) => s !== stroke);
    this.emit({ type: 'redraw' });
  }

  replace(strokes) {
    this.strokes = strokes.map(({ id, by, tool, pts, seq }) => ({ id, by, tool, pts: [...pts], seq, done: true }));
    this.byId = new Map(this.strokes.map((s) => [s.id, s]));
    this.sort();
    this.emit({ type: 'redraw' });
  }

  lastBy(by) {
    for (let i = this.strokes.length - 1; i >= 0; i -= 1) if (this.strokes[i].by === by) return this.strokes[i];
    return null;
  }

  // Server order; a local stroke waits at the end until the server gives it a place.
  sort() {
    const order = (s) => s.seq ?? Number.MAX_SAFE_INTEGER;
    this.strokes.sort((a, b) => order(a) - order(b));
  }
}

export const insideBoard = ({ x, y }) =>
  x >= BOARD.x && x <= BOARD.x + BOARD.width && y >= BOARD.y && y <= BOARD.y + BOARD.height;

function applyStyle(ctx, stroke) {
  const eraser = stroke.tool === 'eraser';
  ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
  ctx.strokeStyle = eraser ? '#000000' : INK[stroke.by] || INK.student;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = eraser ? ERASER_WIDTH : PEN_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// Draws a stroke from its point list, starting at `from` (an index into pts).
export function drawStroke(ctx, stroke, from = 0) {
  const p = stroke.pts;
  const count = p.length / 2;
  if (count === 0) return;
  applyStyle(ctx, stroke);
  if (count === 1) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const first = Math.max(0, from / 2 - 1);
  ctx.beginPath();
  ctx.moveTo(p[first * 2], p[first * 2 + 1]);
  for (let i = first + 1; i < count; i += 1) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
  ctx.stroke();
}

export function drawAll(ctx, strokes) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, STAGE.width, STAGE.height);
  for (const stroke of strokes) drawStroke(ctx, stroke);
}
