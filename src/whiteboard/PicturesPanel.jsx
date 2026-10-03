import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BoxSelect, Gift, Image as ImageIcon, Plus, Wand2 } from 'lucide-react';
import { regionAt } from './regions.js';
import { pictureRegions } from './pictures.js';
import { MAX_PICTURES, startingWidth } from '../../shared/pieces.js';

const DRAG_START = 6; // screen pixels a press moves before it becomes a drag
const card = 'flex flex-col gap-3 rounded-2xl bg-white p-3 shadow';
const primary =
  'flex items-center justify-center gap-2 rounded-full bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50';
const secondary =
  'flex items-center justify-center gap-2 rounded-full border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50';

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const partOf = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, r: r.r || 0 });
const sameCrop = (a, b) => Boolean(a && b) && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const boxFrom = (a, b) => ({
  x: Math.round(Math.min(a.x, b.x)),
  y: Math.round(Math.min(a.y, b.y)),
  w: Math.round(Math.abs(a.x - b.x)),
  h: Math.round(Math.abs(a.y - b.y)),
  r: 0,
});
// The smallest given part under a point.
const offerAt = (list, p) =>
  list.filter((o) => inside(p, o.crop)).sort((a, b) => a.crop.w * a.crop.h - b.crop.w * b.crop.h)[0] || null;

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

// A small label pinned to the top-left corner of a given part.
function Badge({ offer, pic, children }) {
  return (
    <span
      className='pointer-events-none absolute rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow'
      style={{ left: `calc(${(offer.crop.x / pic.w) * 100}% + 4px)`, top: `calc(${(offer.crop.y / pic.h) * 100}% + 4px)` }}
    >
      {children}
    </span>
  );
}

// The Pictures tab. The tutor adds pictures (a file, or paste), lifts any part out with Magic
// Select (or a drawn box), and chooses which parts the student may take: each one once, while
// the student's tools are on. The student sees only those parts. Parts are copies, so the
// picture itself stays whole.
export default function PicturesPanel({
  pictures,
  offers = [],
  srcFor,
  canAdd = false,
  onAddFile,
  library = [],
  onAddFromLibrary,
  onClear,
  onPlace,
  onPlaced,
  onOffer,
  onWithdraw,
  onReset,
  canTake = false,
  stageApi,
  onShow,
}) {
  const student = !canAdd;
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

  const shown = pictures; // both people see every picture
  const pic = shown.find((p) => p.id === openId) || null;
  const src = pic ? srcFor(pic.id) : null;
  const size = pic ? `${pic.w}x${pic.h}` : '';
  const picOffers = pic ? offers.filter((o) => o.pic === pic.id) : [];
  const available = picOffers.filter((o) => !o.taken);
  // First-party cards (the articulation cards) come with predefined regions, like the mouth
  // photo: Magic Select offers exactly those, and a student may take them with tools on.
  const predefined = pic?.regions?.length ? pic.regions : null;
  const predefinedKey = predefined ? predefined.map((r) => `${r.id}:${r.x},${r.y},${r.w},${r.h}`).join(';') : '';
  const takeable = student && predefined ? predefined : [];

  // Each picture's parts are found once, when the tutor first opens it.
  useEffect(() => {
    setRegions([]);
    setSelection(null);
    setHover(null);
    if (!src) return undefined;
    if (predefined) {
      setRegions(predefined); // first-party regions: no detection needed
      return undefined;
    }
    if (student) return undefined;
    const [w, h] = size.split('x').map(Number);
    let live = true;
    pictureRegions(src, { w, h }).then((found) => {
      if (live) setRegions(found);
    });
    return () => {
      live = false;
    };
  }, [src, size, student, predefinedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFile = async (file) => {
    if (!file || !canAdd) return;
    setBusy(true);
    setNote(null);
    const result = await onAddFile(file);
    setBusy(false);
    if (result?.error) setNote(result.error);
    else if (result?.id) setOpenId(result.id);
  };

  // A card from the picture library joins the session and opens, ready for Magic Select.
  const addCard = async (card) => {
    if (!canAdd || !onAddFromLibrary) return;
    setBusy(true);
    setNote(null);
    const result = await onAddFromLibrary(card);
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
  const place = (crop, clientX, clientY, offerId, regionId) => {
    const w = startingWidth(crop);
    const h = (w * crop.h) / crop.w;
    let at = { x: 800, y: 580 };
    if (clientX !== undefined) {
      at = stageApi?.current?.pointAt(clientX, clientY);
      if (!at) return false;
    }
    onPlace({ offer: offerId, region: regionId, pic: pic.id, crop, x: at.x - w / 2, y: at.y - h / 2, w });
    onPlaced?.();
    if (student) setSelection(null);
    return true;
  };

  const toPic = (event) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: Math.min(pic.w, Math.max(0, ((event.clientX - r.left) / r.width) * pic.w)),
      y: Math.min(pic.h, Math.max(0, ((event.clientY - r.top) / r.height) * pic.h)),
    };
  };

  const pickUp = (event, part, offerId, regionId) => {
    press.current = { kind: 'part', part, offer: offerId, region: regionId, sx: event.clientX, sy: event.clientY, dragging: false };
  };

  // Press on a part to pick it up. The tutor can also press anywhere else to draw a box.
  const onDown = (event) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // works without capture too
    }
    setNote(null);
    const p = toPic(event);
    if (student) {
      const offer = offerAt(available, p);
      const region = offer ? null : takeable.find((r) => inside(p, r));
      if (!offer && !region) return;
      if (!canTake) {
        setNote('Your tutor needs to turn on your tools first.');
        return;
      }
      const crop = offer ? offer.crop : partOf(region);
      setSelection(crop);
      pickUp(event, crop, offer?.id, region?.id);
      return;
    }
    let part = selection && inside(p, selection) ? selection : null;
    if (!part) {
      const offer = offerAt(picOffers, p);
      if (offer) part = offer.crop;
    }
    if (!part && mode === 'magic') {
      const region = regionAt(regions, p.x, p.y);
      if (region) part = { x: region.x, y: region.y, w: region.w, h: region.h, r: region.r };
    }
    if (part) {
      setSelection(part);
      pickUp(event, part);
    } else {
      press.current = { kind: 'box', start: p };
      setBox(boxFrom(p, p));
    }
  };

  const onMove = (event) => {
    const current = press.current;
    if (!current) {
      if (event.pointerType !== 'mouse') return;
      const p = toPic(event);
      if (student) setHover(offerAt(available, p)?.crop || null);
      else if (mode === 'magic') setHover(regionAt(regions, p.x, p.y));
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
    if (current.dragging && event.type === 'pointerup' && !place(current.part, event.clientX, event.clientY, current.offer, current.region)) {
      setNote('Drop it on the board to place it.');
    }
  };

  if (pic) {
    const offered = !student && selection ? picOffers.find((o) => sameCrop(o.crop, selection)) : null;
    const chosen = student && selection ? available.find((o) => sameCrop(o.crop, selection)) : null;
    const chosenRegion = student && selection ? takeable.find((r) => sameCrop(partOf(r), selection)) : null;
    let hint = 'Tap a part to select it, or drag across the picture to draw a box.';
    if (mode === 'box') hint = 'Drag across the picture to draw a box around what you want.';
    if (predefined && mode === 'magic') hint = `Tap the ${predefined[0].label.toLowerCase()} to select it.`;
    if (selection) hint = 'Drag the selected part onto the board, or use the buttons below.';
    if (offered) hint = offered.taken ? 'Your student has taken this part.' : 'Your student can take this part once, while their tools are on.';
    if (student && takeable.length) {
      const what = takeable[0].label.toLowerCase();
      hint = canTake ? `Drag the ${what} onto the board.` : `Your tutor will turn on your tools so you can take the ${what}.`;
    } else if (student) {
      if (available.length && canTake) hint = 'Drag the bright part onto the board. You can take it once.';
      else if (available.length) hint = 'Your tutor will turn on your tools so you can take the bright part.';
      else if (picOffers.length) hint = 'You’ve used the part your tutor gave you.';
      else hint = 'Your tutor hasn’t given you a part of this picture yet.';
    }
    const bright = [...available.map((o) => o.crop), ...takeable];
    const dim = `M0 0H${pic.w}V${pic.h}H0Z${bright.map((c) => `M${c.x} ${c.y}h${c.w}v${c.h}h${-c.w}Z`).join('')}`;
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
            className={`absolute inset-0 h-full w-full touch-none ${student ? 'cursor-pointer' : 'cursor-crosshair'}`}
            role='img'
            aria-label={student ? 'Picture. Drag the bright part onto the board.' : 'Picture. Tap a part to select it, then drag it onto the board.'}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
          >
            {student && bright.length > 0 && <path d={dim} fillRule='evenodd' className='fill-slate-900/40' />}
            {(student ? available : picOffers).map((o) => (
              <Outline key={o.id} r={o.crop} className='fill-none stroke-amber-400' />
            ))}
            {hover && !sameCrop(hover, selection) && <Outline r={hover} dashed className='fill-violet-500/10 stroke-violet-400' />}
            {selection && <Outline r={selection} className='fill-violet-500/15 stroke-violet-600' />}
            {box && <Outline r={box} dashed className='fill-sky-500/10 stroke-sky-600' />}
          </svg>
          {picOffers
            .filter((o) => !student || o.taken)
            .map((o) => (
              <Badge key={o.id} offer={o} pic={pic}>
                {student ? 'Used' : o.taken ? 'Taken' : 'For student'}
              </Badge>
            ))}
        </div>
        {!student && (
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
        )}
        <p className='text-xs text-slate-500'>{hint}</p>
        {selection && (!student || ((chosen || chosenRegion) && canTake)) && (
          <button type='button' onClick={() => place(selection, undefined, undefined, chosen?.id, chosenRegion?.id)} className={primary}>
            Add to board
          </button>
        )}
        {!student && selection && !offered && (
          <button type='button' onClick={() => onOffer({ pic: pic.id, crop: selection })} className={secondary}>
            <Gift className='h-4 w-4' aria-hidden='true' />
            Give to student
          </button>
        )}
        {offered?.taken && (
          <button type='button' onClick={() => onReset(offered.id)} className={secondary}>
            Let them take it again
          </button>
        )}
        {offered && (
          <button type='button' onClick={() => onWithdraw(offered.id)} className='text-xs font-semibold text-slate-500 hover:text-rose-600'>
            Take it back from your student
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
        {!student && (
          <span className='text-xs font-semibold text-slate-500'>
            {pictures.length}/{MAX_PICTURES}
          </span>
        )}
      </div>
      {canAdd && (
        <>
          <button
            type='button'
            disabled={busy || pictures.length >= MAX_PICTURES}
            onClick={() => fileRef.current?.click()}
            className={primary}
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
      {canAdd && library.length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <h3 className='text-xs font-bold uppercase tracking-wide text-slate-500'>Library</h3>
          <ul className='flex flex-col gap-1.5'>
            {library.map((card) => (
              <li key={card.id}>
                <button
                  type='button'
                  disabled={busy || pictures.length >= MAX_PICTURES}
                  onClick={() => addCard(card)}
                  className='flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-left hover:border-violet-400 disabled:opacity-50'
                >
                  <ImageIcon className='h-5 w-5 shrink-0 text-violet-600' aria-hidden='true' />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-bold text-slate-800'>{card.title}</span>
                    <span className='block truncate text-xs text-slate-500'>
                      {[card.collection, (card.sounds || []).map((s) => `/${s}/`).join(' ')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Plus className='h-4 w-4 shrink-0 text-violet-600' aria-hidden='true' />
                </button>
              </li>
            ))}
          </ul>
          {shown.length > 0 && <h3 className='mt-1 text-xs font-bold uppercase tracking-wide text-slate-500'>In this session</h3>}
        </div>
      )}
      {shown.length === 0 ? (
        <p className='text-sm text-slate-500'>
          {student ? 'Your tutor hasn’t added any pictures yet.' : 'Add a worksheet or picture, then lift parts out of it with Magic Select.'}
        </p>
      ) : (
        <ul className='-mx-1 flex max-h-[45vh] flex-col gap-2 overflow-y-auto px-1'>
          {shown.map((p, i) => (
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
