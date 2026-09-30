import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Hand from './Hand.jsx';
import InkCanvas from './InkCanvas.jsx';
import Tile from './Tile.jsx';
import { EraserMarker, PenMarker } from './Markers.jsx';
import { INK, STUDENT_LAYER, TUTOR_LAYER, insideBoard } from './board.js';
import { BOARD, CELL_WIDTH, LETTERS, STAGE, STRIP, TOUCH_LIFT, boardRect, clamp, letterAt } from './stage.js';
import { TILE_HEIGHT, clampTile, soundBoxes, tileWidth } from '../../shared/tiles.js';

const VIEW_BOX = `0 0 ${STAGE.width} ${STAGE.height}`;
// Handwriting guides (top line, dashed midline, baseline) stay put even when the board grows.
const GUIDE_LINES = [0.3, 0.55, 0.8].map((f) => BOARD.y + BOARD.height * f);
const PALM_MS = 1500; // touches this soon after an Apple Pencil event count as a resting palm
const CLICK_SLOP = 6; // a tile that moves less than this was clicked, not dragged

const overHand = (p, hand) => p.x >= hand.x - 50 && p.x <= hand.x + 52 && p.y >= hand.y - 10 && p.y <= hand.y + 146;
const overTile = (p, t) => p.x >= t.x && p.x <= t.x + tileWidth(t.text) && p.y >= t.y && p.y <= t.y + TILE_HEIGHT;
const overRemove = (p, t) => Math.hypot(p.x - (t.x + tileWidth(t.text)), p.y - t.y) <= 26;

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

// The bottom layer: the alphabet strip (unless hidden), the board, its guide lines and the sound boxes.
const Backdrop = memo(function Backdrop({ studentLetter, tutorLetter, strip, boxes }) {
  const board = boardRect(strip);
  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio='xMidYMid meet' className='absolute inset-0 h-full w-full' aria-hidden='true'>
      <rect width={STAGE.width} height={STAGE.height} rx='28' className='fill-slate-100' />
      {strip &&
        LETTERS.map((letter, i) => {
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
      <rect x={board.x} y={board.y} width={board.width} height={board.height} rx='20' strokeWidth='3' className='fill-white stroke-slate-200' />
      {GUIDE_LINES.map((y, i) => (
        <line
          key={y}
          x1={BOARD.x + 40}
          x2={BOARD.x + BOARD.width - 40}
          y1={y}
          y2={y}
          strokeWidth='3'
          strokeDasharray={i === 1 ? '16 14' : undefined}
          className='stroke-slate-200'
        />
      ))}
      {soundBoxes(boxes).map((box) => (
        <rect
          key={box.x}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx='16'
          strokeWidth='4'
          strokeDasharray='14 10'
          className='fill-slate-50 stroke-slate-400'
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
// ink, then tiles and pointers on top. `tool` decides what this viewer's pointer does.
// Tiles, and the student's hand on the tutor's screen (`grabbable`), can be dragged
// whatever the tool. Everything is in the fixed 1600 x 1000 stage space.
export default function Stage({
  board,
  me = 'student',
  letters = {},
  strip = true,
  boxes = 0,
  tiles = [],
  selectedTile = null,
  canManageTiles = false,
  tileActions,
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
  const dragging = useRef(null); // the student's hand, being moved by the tutor
  const tileDrag = useRef(null);
  const lastPen = useRef(0);
  const live = useRef({});
  live.current = { onPoint, onLeave, onStroke, onGrab, grabbable, tiles, tileActions, canManageTiles, strip };
  const [layout, setLayout] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [grip, setGrip] = useState(null); // 'grab', 'grabbing' or 'remove', for the cursor

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

  const withLetter = (p) => ({ ...p, letter: letterAt(p.x, p.y, live.current.strip) });

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

  // The tile under a point, topmost first. For the tutor, a tile's delete button counts too.
  const pickTile = (p) => {
    const { tiles: list, canManageTiles: manage } = live.current;
    const top = [...list].sort((a, b) => b.z - a.z);
    if (manage) {
      const doomed = top.find((t) => overRemove(p, t));
      if (doomed) return { tile: doomed, remove: true };
    }
    const tile = top.find((t) => overTile(p, t));
    return tile ? { tile, remove: false } : null;
  };

  const onPointerDown = (event) => {
    if (isPalm(event)) return;
    const { onPoint: point, onStroke: stroke, onGrab: grab, grabbable: hand, tileActions: tileOps } = live.current;
    const raw = toStage(event.clientX, event.clientY);
    if (!raw) return;
    if (hand && grab && overHand(raw, hand)) {
      capture(event);
      dragging.current = { pointerId: event.pointerId, dx: hand.x - raw.x, dy: hand.y - raw.y };
      setGrip('grabbing');
      grab.start?.();
      return;
    }
    const picked = tileOps ? pickTile(raw) : null;
    if (picked) {
      const { tile } = picked;
      if (picked.remove) {
        tileOps.remove(tile.id);
        return;
      }
      if (tile.heldBy && tile.heldBy !== me) return; // the other person has it right now
      capture(event);
      tileDrag.current = {
        pointerId: event.pointerId,
        id: tile.id,
        text: tile.text,
        dx: tile.x - raw.x,
        dy: tile.y - raw.y,
        sx: raw.x,
        sy: raw.y,
        x: tile.x,
        y: tile.y,
        moved: false,
      };
      setGrip('grabbing');
      tileOps.grab(tile.id);
      if (tool !== 'none') point?.({ ...raw, letter: null });
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
    if (drawing.current !== null || !insideBoard(raw, boardRect(live.current.strip))) return;
    capture(event);
    drawing.current = event.pointerId;
    stroke?.start(raw);
  };

  const onPointerMove = (event) => {
    if (isPalm(event)) return;
    const { onPoint: point, onStroke: stroke, onGrab: grab, grabbable: hand, tileActions: tileOps } = live.current;
    const drag = dragging.current;
    if (drag && drag.pointerId === event.pointerId) {
      const raw = toStage(event.clientX, event.clientY);
      if (!raw) return;
      grab?.move(withLetter({ x: clamp(raw.x + drag.dx, 0, STAGE.width), y: clamp(raw.y + drag.dy, 0, STAGE.height) }));
      if (tool === 'hand') point?.(withLetter(raw));
      else if (tool !== 'none') point?.({ ...raw, letter: null });
      return;
    }
    const td = tileDrag.current;
    if (td && td.pointerId === event.pointerId) {
      const raw = toStage(event.clientX, event.clientY);
      if (!raw) return;
      if (Math.abs(raw.x - td.sx) + Math.abs(raw.y - td.sy) > CLICK_SLOP) td.moved = true;
      const pos = clampTile(td.text, raw.x + td.dx, raw.y + td.dy);
      td.x = pos.x;
      td.y = pos.y;
      tileOps?.move(td.id, pos.x, pos.y);
      if (tool !== 'none') point?.({ ...raw, letter: null });
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
    if (event.pointerType === 'mouse') {
      let next = null;
      if (hand && grab && overHand(raw, hand)) next = 'grab';
      else {
        const picked = tileOps ? pickTile(raw) : null;
        if (picked) next = picked.remove ? 'remove' : 'grab';
      }
      setGrip(next);
    }
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
    const td = tileDrag.current;
    if (td && td.pointerId === event.pointerId) {
      tileDrag.current = null;
      setGrip(null);
      const { tileActions: tileOps, canManageTiles: manage } = live.current;
      if (!td.moved && manage) tileOps?.select?.(td.id); // a click picks the tile for changing
      tileOps?.drop(td.id, td.x, td.y);
      return;
    }
    if (drawing.current === event.pointerId) {
      drawing.current = null;
      live.current.onStroke?.end();
    }
  };

  const onPointerLeave = (event) => {
    if (event.pointerType !== 'mouse' || dragging.current || tileDrag.current) return;
    setGrip(null);
    if (tool === 'pen' || tool === 'eraser') live.current.onLeave?.();
  };

  let cursor = tool === 'none' ? '' : 'cursor-none';
  if (grip === 'grab') cursor = 'cursor-grab';
  if (grip === 'grabbing') cursor = 'cursor-grabbing';
  if (grip === 'remove') cursor = 'cursor-pointer';
  const touchable = tool !== 'none' || Boolean(grabbable) || tiles.length > 0;
  const clip = boardRect(strip);
  const stacked = [...tiles].sort((a, b) => a.z - b.z);

  return (
    <div ref={wrapRef} className='relative h-full w-full select-none'>
      <Backdrop studentLetter={letters.student ?? null} tutorLetter={letters.tutor ?? null} strip={strip} boxes={boxes} />
      <InkCanvas board={board} layout={layout} include={TUTOR_LAYER} clip={clip} />
      <InkCanvas board={board} layout={layout} include={STUDENT_LAYER} clip={clip} />
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
        {stacked.map((tile) => (
          <Tile key={tile.id} tile={tile} mine={me} selected={tile.id === selectedTile} removable={canManageTiles} />
        ))}
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
