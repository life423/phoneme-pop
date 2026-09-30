import { useRef } from 'react';
import Hand from './Hand.jsx';
import { BOARD, CELL_WIDTH, LETTERS, STAGE, STRIP, TOUCH_LIFT, clamp, letterAt } from './stage.js';

const GUIDE_LINES = [0.3, 0.55, 0.8]; // handwriting guides: top line, dashed midline, baseline

// The shared alphabet strip and whiteboard. Pass onPoint to let this viewer move the hand.
export default function Stage({ hand, activeLetter, onPoint, smooth = false }) {
  const svgRef = useRef(null);

  const toStage = (event) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const lift = event.pointerType === 'touch' ? TOUCH_LIFT : 0;
    const x = clamp(point.x, 0, STAGE.width);
    const y = clamp(point.y - lift, 0, STAGE.height);
    return { x, y, letter: letterAt(x, y) };
  };

  const pointerHandlers = onPoint
    ? {
        onPointerDown: (event) => {
          if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId);
          const point = toStage(event);
          if (point) onPoint(point);
        },
        onPointerMove: (event) => {
          if (event.pointerType !== 'mouse' && event.buttons === 0) return;
          const point = toStage(event);
          if (point) onPoint(point);
        },
      }
    : {};

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      preserveAspectRatio='xMidYMid meet'
      className={`h-full w-full select-none ${onPoint ? 'cursor-none touch-none' : ''}`}
      style={{ WebkitTouchCallout: 'none' }}
      role='img'
      aria-label={activeLetter ? `Alphabet strip, pointing at ${activeLetter}` : 'Alphabet strip and whiteboard'}
      {...pointerHandlers}
    >
      <rect width={STAGE.width} height={STAGE.height} rx='28' className='fill-slate-100' />

      {LETTERS.map((letter, i) => {
        const active = letter === activeLetter;
        const x = STRIP.x + i * CELL_WIDTH;
        return (
          <g key={letter}>
            <rect
              x={x + 3}
              y={STRIP.y}
              width={CELL_WIDTH - 6}
              height={STRIP.height}
              rx='14'
              strokeWidth={active ? 5 : 3}
              className={active ? 'fill-violet-100 stroke-violet-500' : 'fill-white stroke-slate-200'}
            />
            <text
              x={x + CELL_WIDTH / 2}
              y={STRIP.y + STRIP.height / 2}
              textAnchor='middle'
              dominantBaseline='central'
              className={active ? 'fill-violet-800' : 'fill-slate-800'}
              style={{ fontSize: 56, fontWeight: 800 }}
            >
              {letter}
            </text>
          </g>
        );
      })}

      <rect x={BOARD.x} y={BOARD.y} width={BOARD.width} height={BOARD.height} rx='20' strokeWidth='3' className='fill-white stroke-slate-200' />
      {GUIDE_LINES.map((f) => (
        <line
          key={f}
          x1={BOARD.x + 40}
          x2={BOARD.x + BOARD.width - 40}
          y1={BOARD.y + BOARD.height * f}
          y2={BOARD.y + BOARD.height * f}
          strokeWidth='3'
          strokeDasharray={f === 0.55 ? '16 14' : undefined}
          className='stroke-slate-200'
        />
      ))}

      {hand && <Hand x={hand.x} y={hand.y} smooth={smooth} />}
    </svg>
  );
}
