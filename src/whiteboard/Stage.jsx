import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Hand from './Hand.jsx';
import InkCanvas from './InkCanvas.jsx';
import { EraserMarker, PenMarker } from './Markers.jsx';
import { INK, insideBoard } from './board.js';
import { BOARD, CELL_WIDTH, LETTERS, STAGE, STRIP, TOUCH_LIFT, clamp, letterAt } from './stage.js';

const VIEW_BOX = `0 0 ${STAGE.width} ${STAGE.height}`;
const GUIDE_LINES = [0.3, 0.55, 0.8]; // handwriting guides: top line, dashed midline, baseline
const PALM_MS = 1500; // touches this soon after an Apple Pencil event count as a resting palm

// Layer 1: the alphabet strip and the whiteboard itself.
const Backdrop = memo(function Backdrop({ activeLetter }) {
  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio='xMidYMid meet' className='absolute inset-0 h-full w-full' aria-hidden='true'>
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
    </svg>
  );
});

function Marker({ kind, x, y, by, smooth }) {
  if (kind === 'hand') return <Hand x={x} y={y} smooth={smooth} />;
  if (kind === 'pen') return <PenMarker x={x} y={y} color={INK[by]} smooth={smooth} />;
  if (kind === 'eraser') return <EraserMarker x={x} y={y} smooth={smooth} />;
  return null;
}

// The shared stage in three layers: the letters and board, the ink, and the pointers
// on top. `tool` decides what this viewer's pointer does: nothing, the hand, the pen
// or the eraser. Everything is in the fixed 1600 x 1000 stage space.
export default function Stage({ board, activeLetter, tool = 'none', markers = [], onPoint, onLeave, onStroke }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const drawing = useRef(null);
  const lastPen = useRef(0);
  const callbacks = useRef({});
  callbacks.current = { onPoint, onLeave, onStroke };
  const [layout, setLayout] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Where the letterboxed stage actually sits, so the ink canvas can line up with it.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    const update = () => {
      const width = Math.min(el.clientWidth, (el.clientHeight * STAGE.width) / STAGE.height);
      const height = (width * STAGE.height) / STAGE.width;
      setLayout({ left: (el.clientWidth - width) / 2, top: (el.clientHeight - height) / 2, width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Changing tools (or losing them) ends any stroke in progress.
  useEffect(() => {
    if (drawing.current === null) return;
    drawing.current = null;
    callbacks.current.onStroke?.end();
  }, [tool]);

  const toStage = (clientX, clientY, lift = 0) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: clamp(p.x, 0, STAGE.width), y: clamp(p.y - lift, 0, STAGE.height) };
  };

  const handPoint = (event) => {
    const p = toStage(event.clientX, event.clientY, event.pointerType === 'touch' ? TOUCH_LIFT : 0);
    return p && { ...p, letter: letterAt(p.x, p.y) };
  };

  const isPalm = (event) => {
    if (event.pointerType === 'pen') lastPen.current = performance.now();
    return event.pointerType === 'touch' && performance.now() - lastPen.current < PALM_MS;
  };

  // Capture keeps a stroke going if the finger slides off the stage; some browsers refuse it.
  const capture = (event) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // drawing still works without it
    }
  };

  const endStroke = (event) => {
    if (drawing.current !== event.pointerId) return;
    drawing.current = null;
    callbacks.current.onStroke?.end();
  };

  const handlers =
    tool === 'none'
      ? {}
      : {
          onPointerDown: (event) => {
            if (isPalm(event)) return;
            const { onPoint: point, onStroke: stroke } = callbacks.current;
            if (tool === 'hand') {
              if (event.pointerType !== 'mouse') capture(event);
              const p = handPoint(event);
              if (p) point?.(p);
              return;
            }
            const p = toStage(event.clientX, event.clientY);
            if (!p) return;
            point?.({ ...p, letter: null });
            if (drawing.current !== null || !insideBoard(p)) return;
            capture(event);
            drawing.current = event.pointerId;
            stroke?.start(p);
          },
          onPointerMove: (event) => {
            if (isPalm(event)) return;
            const { onPoint: point, onStroke: stroke } = callbacks.current;
            if (tool === 'hand') {
              if (event.pointerType !== 'mouse' && event.buttons === 0) return;
              const p = handPoint(event);
              if (p) point?.(p);
              return;
            }
            if (drawing.current === event.pointerId) {
              const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
              const pts = (coalesced.length ? coalesced : [event])
                .map((e) => toStage(e.clientX, e.clientY))
                .filter(Boolean);
              stroke?.move(pts);
              if (pts.length) point?.({ ...pts[pts.length - 1], letter: null });
            } else if (event.pointerType !== 'touch') {
              const p = toStage(event.clientX, event.clientY);
              if (p) point?.({ ...p, letter: null });
            }
          },
          onPointerUp: endStroke,
          onPointerCancel: endStroke,
          onPointerLeave: (event) => {
            if (event.pointerType === 'mouse' && tool !== 'hand') callbacks.current.onLeave?.();
          },
        };

  return (
    <div ref={wrapRef} className='relative h-full w-full select-none'>
      <Backdrop activeLetter={activeLetter} />
      <InkCanvas board={board} layout={layout} />
      <svg
        ref={svgRef}
        viewBox={VIEW_BOX}
        preserveAspectRatio='xMidYMid meet'
        className={`absolute inset-0 h-full w-full ${tool === 'none' ? '' : 'cursor-none touch-none'}`}
        style={{ WebkitTouchCallout: 'none' }}
        role='img'
        aria-label={activeLetter ? `Alphabet strip, pointing at ${activeLetter}` : 'Alphabet strip and whiteboard'}
        {...handlers}
      >
        <rect width={STAGE.width} height={STAGE.height} fill='transparent' />
        {markers.map(({ key, ...marker }) => (
          <Marker key={key} {...marker} />
        ))}
      </svg>
    </div>
  );
}
