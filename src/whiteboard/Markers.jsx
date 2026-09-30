import { ERASER_WIDTH } from './board.js';

const SMOOTH = 'motion-safe:transition-transform motion-safe:duration-75 motion-safe:ease-linear';

// Where someone's pen is, even between strokes.
export function PenMarker({ x, y, color, smooth = false }) {
  return (
    <g pointerEvents='none' className={smooth ? SMOOTH : ''} style={{ transform: `translate(${x}px, ${y}px)` }}>
      <circle r='13' fill='#ffffff' fillOpacity='0.85' stroke={color} strokeWidth='3' />
      <circle r='5' fill={color} />
    </g>
  );
}

// The eraser's footprint, drawn at its real size.
export function EraserMarker({ x, y, smooth = false }) {
  return (
    <g pointerEvents='none' className={smooth ? SMOOTH : ''} style={{ transform: `translate(${x}px, ${y}px)` }}>
      <circle r={ERASER_WIDTH / 2} fill='#ffffff' fillOpacity='0.4' stroke='#475569' strokeWidth='3' strokeDasharray='8 6' />
    </g>
  );
}
