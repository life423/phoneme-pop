import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BoxSelect, Plus, Wand2 } from 'lucide-react';
import { regionAt } from './regions.js';
import { pictureRegions } from './pictures.js';
import { MAX_PICTURES, startingWidth } from '../../shared/pieces.js';

const DRAG_START = 6; // screen pixels a press moves before it becomes a drag
const card = 'flex flex-col gap-3 rounded-2xl bg-white p-3 shadow';

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const boxFrom = (a, b) => ({
  x: Math.round(Math.min(a.x, b.x)),
  y: Math.round(Math.min(a.y, b.y)),
  w: Math.round(Math.abs(a.x - b.x)),
  h: Math.round(Math.abs(a.y - b.y)),
  r: 0,
});

// The part being dragged to the board, drawn under the finger.
function Ghost({ src, pic, crop, width }) {
  return (
    <svg
      width={width}
      height={(width * crop.h) / crop.w}
      viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
      preserveAspectRatio='none'
      className='block'
    >
      <defs>
        <clipPath id='ghost-clip'>
          <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} rx={crop.r} />
        </clipPath>
      </defs>
      <image href={src} width={pic.w} height={pic.h} clipPath='url(#ghost-clip)' preserveAspectRatio='none' />
    </svg>
  );
}

function Outline({ r, className, dashed = false }) {
  return (
    <rect
      x={r.x}
      y={r.y}
      width={r.w}
      height={r.h}
      rx={r.r || 0}
      strokeWidth='3'
      strokeDasharray={dashed ? '8 6' : undefined}
      vectorEffect='non-scaling-stroke'
      className={className}
    />
  );
}

// The Pictures tab. The tutor adds pictures (a file, or paste); both people open one, pick a
// part with Magic Select (or draw a box), and drag it onto the board. Parts are copies: the
// picture itself stays whole, so the same part can be taken again.
export default function PicturesPanel({ pictures, srcFor, canAdd = false, onAddFile, onClear, onPlace, stageApi, onShow }) {
  const [openId, setOpenId] = useState(null);
  const [regions, setRegions] = useState([]);
  const [mode, setMode] = useState('magic');
  const [hover, setHover] = useState(null);
  const [selection, setSelection] = useState(null);
  const [box, setBox] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [armed, setArmed] = useState(false);
  const fileRef = useRef(null);
  const svgRef = useRef(null);
  const press = useRef(null);

  const pic = pictures.find((p) => p.id === openId) || null;
  const src = pic ? srcFor(pic.id) : null;
  const size = pic ? `${pic.w}x${pic.h}` : '';

  // Each picture's parts are found once, when it's first opened.
  useEffect(() => {
    setRegions([]);
    setSelection(null);
    setHover(null);
    if (!src) return undefined;
    const [w, h] = size.split('x').map(Number);
    let live = true;
    pictureRegions(src, { w, h }).then((found) => {
      if (live) setRegions(found);
    });
    return () => {
      live = false;
    };
  }, [src, size]);

  const addFile = async (file) => {
    if (!file || !canAdd) return;
    setBusy(true);
    setNote(null);
    const result = await onAddFile(file);
    setBusy(false);
    if (result?.error) setNote(result.error);
    else if (result?.id) setOpenId(result.id);
  };

  // Pasting an image anywhere on the page adds it (tutor only).
  useEffect(() => {
    if (!canAdd) return undefined;
    const onPaste = (event) => {
      const file = [...(event.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      onShow?.();
      addFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // Puts a part on the board: where it was dropped, or in the middle of the board.
  const place = (crop, clientX, clientY) => {
    const w = startingWidth(crop);
    const h = (w * crop.h) / crop.w;
    let at = { x: 800, y: 580 };
    if (clientX !== undefined) {
      at = stageApi?.current?.pointAt(clientX, clientY);
      if (!at) return false;
    }
    onPlace({ pic: pic.id, crop, x: at.x - w / 2, y: at.y - h / 2, w });
    return true;
  };

  const toPic = (event) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: Math.min(pic.w, Math.max(0, ((event.clientX - r.left) / r.width) * pic.w)),
      y: Math.min(pic.h, Math.max(0, ((event.clientY - r.top) / r.height) * pic.h)),
    };
  };

  // Press on a part (or the selection) to pick it up; press anywhere else to draw a box.
  const onDown = (event) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // works without capture too
    }
    setNote(null);
    const p = toPic(event);
    let part = selection && inside(p, selection) ? selection : null;
    if (!part && mode === 'magic') {
      const region = regionAt(regions, p.x, p.y);
      if (region) {
        part = { x: region.x, y: region.y, w: region.w, h: region.h, r: region.r };
        setSelection(part);
      }
    }
    if (part) {
      press.current = { kind: 'part', part, sx: event.clientX, sy: event.clientY, dragging: false };
    } else {
      press.current = { kind: 'box', start: p };
      setBox(boxFrom(p, p));
    }
  };

  const onMove = (event) => {
    const current = press.current;
    if (!current) {
      if (mode === 'magic' && event.pointerType === 'mouse') {
        const p = toPic(event);
        setHover(regionAt(regions, p.x, p.y));
      }
      return;
    }
    if (current.kind === 'box') {
      setBox(boxFrom(current.start, toPic(event)));
      return;
    }
    if (!current.dragging && Math.hypot(event.clientX - current.sx, event.clientY - current.sy) < DRAG_START) return;
    current.dragging = true;
    const scale = stageApi?.current?.scale || 0.6;
    setGhost({ x: event.clientX, y: event.clientY, width: startingWidth(current.part) * scale, part: current.part });
  };

  const onUp = (event) => {
    const current = press.current;
    press.current = null;
    if (!current) return;
    if (current.kind === 'box') {
      const drawn = boxFrom(current.start, toPic(event));
      setBox(null);
      const min = Math.max(12, Math.min(pic.w, pic.h) * 0.02);
      if (drawn.w >= min && drawn.h >= min) setSelection(drawn);
      return;
    }
    setGhost(null);
    if (current.dragging && event.type === 'pointerup' && !place(current.part, event.clientX, event.clientY)) {
      setNote('Drop it on the board to place it.');
    }
  };

  if (pic) {
    let hint = 'Tap a part to select it, or drag across the picture to draw a box.';
    if (mode === 'box') hint = 'Drag across the picture to draw a box around what you want.';
    if (selection) hint = 'Drag the selected part onto the board, or use Add to board.';
    return (
      <section aria-label='Pictures' className={card}>
        <button
          type='button'
          onClick={() => setOpenId(null)}
          className='flex items-center gap-1 self-start text-sm font-semibold text-violet-700 hover:underline'
        >
          <ArrowLeft className='h-4 w-4' aria-hidden='true' />
          All pictures
        </button>
        <div className='relative overflow-hidden rounded-xl border border-slate-200 bg-white'>
          <img src={src} alt='' draggable={false} className='block w-full select-none' />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${pic.w} ${pic.h}`}
            preserveAspectRatio='none'
            className='absolute inset-0 h-full w-full cursor-crosshair touch-none'
            role='img'
            aria-label='Picture. Tap a part to select it, then drag it onto the board.'
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
          >
            {hover && hover !== selection && <Outline r={hover} dashed className='fill-violet-500/10 stroke-violet-400' />}
            {selection && <Outline r={selection} className='fill-violet-500/15 stroke-violet-600' />}
            {box && <Outline r={box} dashed className='fill-sky-500/10 stroke-sky-600' />}
          </svg>
        </div>
        <div role='group' aria-label='How to select' className='grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1'>
          {[
            ['magic', 'Magic select', Wand2],
            ['box', 'Draw a box', BoxSelect],
          ].map(([value, label, Icon]) => (
            <button
              key={value}
              type='button'
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold ${
                mode === value ? 'bg-white text-violet-700 shadow' : 'text-slate-600 hover:text-violet-700'
              }`}
            >
              <Icon className='h-4 w-4' aria-hidden='true' />
              {label}
            </button>
          ))}
        </div>
        <p className='text-xs text-slate-500'>{hint}</p>
        {selection && (
          <button
            type='button'
            onClick={() => place(selection)}
            className='rounded-full bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700'
          >
            Add to board
          </button>
        )}
        {note && (
          <p role='status' className='text-xs font-semibold text-amber-700'>
            {note}
          </p>
        )}
        {ghost && (
          <div
            className='pointer-events-none fixed z-50 opacity-90 drop-shadow-xl'
            style={{ left: ghost.x - ghost.width / 2, top: ghost.y - (ghost.width * ghost.part.h) / ghost.part.w / 2 }}
          >
            <Ghost src={src} pic={pic} crop={ghost.part} width={ghost.width} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label='Pictures' className={card}>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-bold text-slate-700'>Pictures</h2>
        <span className='text-xs font-semibold text-slate-500'>
          {pictures.length}/{MAX_PICTURES}
        </span>
      </div>
      {canAdd && (
        <>
          <button
            type='button'
            disabled={busy || pictures.length >= MAX_PICTURES}
            onClick={() => fileRef.current?.click()}
            className='flex items-center justify-center gap-2 rounded-full bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50'
          >
            <Plus className='h-4 w-4' aria-hidden='true' />
            {busy ? 'Adding…' : 'Add picture'}
          </button>
          <input
            ref={fileRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              addFile(file);
            }}
          />
          <p className='-mt-1 text-xs text-slate-500'>Or paste an image. Pictures are kept for this session only.</p>
        </>
      )}
      {note && (
        <p role='status' className='text-xs font-semibold text-amber-700'>
          {note}
        </p>
      )}
      {pictures.length === 0 ? (
        <p className='text-sm text-slate-500'>
          {canAdd ? 'Add a worksheet or picture, then lift parts out of it with Magic Select.' : 'Your tutor hasn’t added any pictures yet.'}
        </p>
      ) : (
        <ul className='-mx-1 flex max-h-[45vh] flex-col gap-2 overflow-y-auto px-1'>
          {pictures.map((p, i) => (
            <li key={p.id}>
              <button
                type='button'
                aria-label={`Open picture ${i + 1}`}
                onClick={() => {
                  setNote(null);
                  setOpenId(p.id);
                }}
                className='block w-full overflow-hidden rounded-xl border-2 border-slate-200 bg-white hover:border-violet-400'
              >
                <img src={srcFor(p.id)} alt='' draggable={false} className='mx-auto block max-h-40 w-auto' />
              </button>
            </li>
          ))}
        </ul>
      )}
      {canAdd && pictures.length > 0 && (
        <button
          type='button'
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            onClear();
          }}
          onBlur={() => setArmed(false)}
          className={`rounded-full px-3 py-2 text-sm font-semibold ${armed ? 'bg-rose-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {armed ? 'Sure? Pictures and their pieces go' : 'Remove all pictures'}
        </button>
      )}
    </section>
  );
}
