import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Hand from './Hand.jsx';
import InkCanvas from './InkCanvas.jsx';
import { EraserMarker, PenMarker } from './Markers.jsx';
import { INK, STUDENT_LAYER, TUTOR_LAYER, insideBoard } from './board.js';
import { BOARD, CELL_WIDTH, LETTERS, STAGE, STRIP, TOUCH_LIFT, clamp, letterAt } from './stage.js';

const VIEW_BOX = `0 0 ${STAGE.width} ${STAGE.height}`;
const GUIDE_LINES = [0.3, 0.55, 0.8]; // handwriting guides: top line, dashed midline, baseline
const PALM_MS = 1500; // touches this soon after an Apple Pencil event count as a resting palm

// The glove's footprint around its fingertip, for grabbing it.
const overHand = (p, hand) => p.x >= hand.x - 50 && p.x <= hand.x + 52 && p.y >= hand.y - 10 && p.y <= hand.y + 146;

// Letter highlights: violet under the student's hand, blue under the tutor's.
function letterTone(letter, studentLetter, tutorLetter) {
  const student = letter === studentLetter;
  const tutor = letter === tutorLetter;
  if (!student && !tutor) return { cell: 'fill-white stroke-slate-200', text: 'fill-slate-800', width: 3 };
  return {
    cell: `${student ? 'fill-violet-100' : 'fill-blue-100'} ${tutor ? 'stroke-blue-500' : 'stroke-violet-500'}`,
    text: student ? 'fill-violet-800' : 'fill-blue-800',
    width: 5,
  };
}

// The bottom layer: the alphabet strip and the whiteboard itself.
const Backdrop = memo(function Backdrop({ studentLetter, tutorLetter }) {
  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio='xMidYMid meet' className='absolute inset-0 h-full w-full' aria-hidden='true'>
      <rect width={STAGE.width} height={STAGE.height} rx='28' className='fill-slate-100' />
      {LETTERS.map((letter, i) => {
        const tone = letterTone(letter, studentLetter, tutorLetter);
        const x = STRIP.x + i * CELL_WIDTH;
        return (
          <g key={letter}>
            <rect x={x + 3} y={STRIP.y} width={CELL_WIDTH - 6} height={STRIP.height} rx='14' strokeWidth={tone.width} className={tone.cell} />
            <text
              x={x + CELL_WIDTH / 2}
              y={STRIP.y + STRIP.height / 2}
              textAnchor='middle'
              dominantBaseline='central'
              className={tone.text}
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

function Marker({ kind, x, y, by, smooth, glow }) {
  if (kind === 'hand') return <Hand x={x} y={y} by={by} smooth={smooth} glow={glow} />;
  if (kind === 'pen') return <PenMarker x={x} y={y} color={INK[by]} smooth={smooth} />;
  if (kind === 'eraser') return <EraserMarker x={x} y={y} smooth={smooth} />;
  return null;
}

// The shared stage in layers: the letters and board, the tutor's ink, the student's
// ink, and the pointers on top. `tool` decides what this viewer's pointer does:
// nothing, a hand, the pen or the eraser. A `grabbable` hand (the student's, on the
// tutor's screen) can be dragged whatever the tool. All in the 1600 x 1000 stage space.
export default function Stage({
  board,
  letters = {},
  tool = 'none',
  markers = [],
  grabbable = null,
  onGrab,
  onPoint,
  onLeave,
  onStroke,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const drawing = useRef(null);
  const dragging = useRef(null);
  const lastPen = useRef(0);
  const live = useRef({});
  live.current = { onPoint, onLeave, onStroke, onGrab, grabbable };
  const [layout, setLayout] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [grip, setGrip] = useState(null); // 'grab' over the student's hand, 'grabbing' while dragging it

  // Where the letterboxed stage actually sits, so the ink canvases can line up with it.
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
    live.current.onStroke?.end();
  }, [tool]);

  const toStage = (clientX, clientY, lift = 0) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: clamp(p.x, 0, STAGE.width), y: clamp(p.y - lift, 0, STAGE.height) };
  };

  const withLetter = (p) => ({ ...p, letter: letterAt(p.x, p.y) });

  const handPoint = (event) => {
    const p = toStage(event.clientX, event.clientY, event.pointerType === 'touch' ? TOUCH_LIFT : 0);
    return p && withLetter(p);
  };

  const isPalm = (event) => {
    if (event.pointerType === 'pen') lastPen.current = performance.now();
    return event.pointerType === 'touch' && performance.now() - lastPen.current < PALM_MS;
  };

  // Capture keeps a stroke or drag going if the finger slides off the stage; some browsers refuse it.
  const capture = (event) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // it still works without capture
    }
  };

  const onPointerDown = (event) => {
    if (isPalm(event)) return;
    const { onPoint: point, onStroke: stroke, onGrab: grab, grabbable: hand } = live.current;
    const raw = toStage(event.clientX, event.clientY);
    if (!raw) return;
    if (hand && grab && overHand(raw, hand)) {
      capture(event);
      dragging.current = { pointerId: event.pointerId, dx: hand.x - raw.x, dy: hand.y - raw.y };
      setGrip('grabbing');
      grab.start?.();
      return;
    }
    if (tool === 'none') return;
    if (tool === 'hand') {
      if (event.pointerType !== 'mouse') capture(event);
      const p = handPoint(event);
      if (p) point?.(p);
      return;
    }
    point?.({ ...raw, letter: null });
    if (drawing.current !== null || !insideBoard(raw)) return;
    capture(event);
    drawing.current = event.pointerId;
    stroke?.start(raw);
  };

  const onPointerMove = (event) => {
    if (isPalm(event)) return;
    const { onPoint: point, onStroke: stroke, onGrab: grab, grabbable: hand } = live.current;
    const drag = dragging.current;
    if (drag && drag.pointerId === event.pointerId) {
      const raw = toStage(event.clientX, event.clientY);
      if (!raw) return;
      grab?.move(withLetter({ x: clamp(raw.x + drag.dx, 0, STAGE.width), y: clamp(raw.y + drag.dy, 0, STAGE.height) }));
      if (tool === 'hand') point?.(withLetter(raw));
      else if (tool !== 'none') point?.({ ...raw, letter: null });
      return;
    }
    if (drawing.current === event.pointerId) {
      const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
      const pts = (coalesced.length ? coalesced : [event]).map((e) => toStage(e.clientX, e.clientY)).filter(Boolean);
      stroke?.move(pts);
      if (pts.length) point?.({ ...pts[pts.length - 1], letter: null });
      return;
    }
    const raw = toStage(event.clientX, event.clientY);
    if (!raw) return;
    if (event.pointerType === 'mouse') setGrip(hand && grab && overHand(raw, hand) ? 'grab' : null);
    if (tool === 'none') return;
    if (tool === 'hand') {
      if (event.pointerType !== 'mouse' && event.buttons === 0) return;
      const p = handPoint(event);
      if (p) point?.(p);
      return;
    }
    if (event.pointerType !== 'touch') point?.({ ...raw, letter: null });
  };

  const onRelease = (event) => {
    if (dragging.current?.pointerId === event.pointerId) {
      dragging.current = null;
      setGrip(null);
      live.current.onGrab?.end?.();
      return;
    }
    if (drawing.current === event.pointerId) {
      drawing.current = null;
      live.current.onStroke?.end();
    }
  };

  const onPointerLeave = (event) => {
    if (event.pointerType !== 'mouse' || dragging.current) return;
    setGrip(null);
    if (tool === 'pen' || tool === 'eraser') live.current.onLeave?.();
  };

  let cursor = tool === 'none' ? '' : 'cursor-none';
  if (grip === 'grab') cursor = 'cursor-grab';
  if (grip === 'grabbing') cursor = 'cursor-grabbing';
  const touchable = tool !== 'none' || Boolean(grabbable);

  return (
    <div ref={wrapRef} className='relative h-full w-full select-none'>
      <Backdrop studentLetter={letters.student ?? null} tutorLetter={letters.tutor ?? null} />
      <InkCanvas board={board} layout={layout} include={TUTOR_LAYER} />
      <InkCanvas board={board} layout={layout} include={STUDENT_LAYER} />
      <svg
        ref={svgRef}
        viewBox={VIEW_BOX}
        preserveAspectRatio='xMidYMid meet'
        className={`absolute inset-0 h-full w-full ${cursor} ${touchable ? 'touch-none' : ''}`}
        style={{ WebkitTouchCallout: 'none' }}
        role='img'
        aria-label={letters.student ? `Alphabet strip, pointing at ${letters.student}` : 'Alphabet strip and whiteboard'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onPointerLeave={onPointerLeave}
      >
        <rect width={STAGE.width} height={STAGE.height} fill='transparent' />
        {markers.map(({ key, ...marker }) => (
          <Marker
            key={key}
            {...marker}
            glow={Boolean(grip) && Boolean(grabbable) && marker.by === 'student' && marker.kind === 'hand'}
          />
        ))}
      </svg>
    </div>
  );
}
