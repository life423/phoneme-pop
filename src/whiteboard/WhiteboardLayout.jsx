import { useEffect, useRef, useState } from 'react';
import { Minimize2, Pencil, X } from 'lucide-react';
import { BOARD_SHAPE } from './stage.js';
import VideoPanel from './VideoPanel.jsx';

// The one layout the tutor's and the student's screens share.
//  - Wide screens (1024px and up): tools | board | side column (video, then the panels).
//  - Narrower screens (tablets, phones): the board as big as fits, with the tools behind a
//    floating pencil button, the video in a small window you can drag or shrink, and the
//    panels (letter tiles, pictures) in a sheet that slides up from a bar at the bottom.
//  - Focus mode, on any screen: just the board, the rest tucked away.
// The board is always the same 1600 x 1000 stage, scaled to fit, so both people see the
// same thing whatever their screens. `controls` lets a room open a panel or start focus mode.
const COMPACT = '(max-width: 1023.98px)';

function useCompact() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches);
  useEffect(() => {
    const query = window.matchMedia(COMPACT);
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}

// The drawing tools on narrower screens: a pencil button that opens the tool rail.
function FloatingTools({ tools, focus }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 640);
  useEffect(() => {
    if (focus) setOpen(false);
  }, [focus]);
  return (
    <div className='pointer-events-none absolute bottom-3 left-3 z-20 flex max-h-[calc(100%-1.5rem)] items-end gap-2 landscape:bottom-auto landscape:top-3 landscape:items-start'>
      <button
        type='button'
        aria-expanded={open}
        aria-label={open ? 'Hide drawing tools' : 'Show drawing tools'}
        title={open ? 'Hide drawing tools' : 'Show drawing tools'}
        onClick={() => setOpen((was) => !was)}
        className='pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700'
      >
        {open ? <X className='h-5 w-5' aria-hidden='true' /> : <Pencil className='h-5 w-5' aria-hidden='true' />}
      </button>
      {open && <div className='pointer-events-auto max-h-full overflow-y-auto rounded-2xl'>{tools}</div>}
    </div>
  );
}

// A small video window over the board that can be dragged anywhere in its area.
function FloatingVideo({ children }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const box = useRef(null);
  const drag = useRef(null);
  const onDown = (event) => {
    if (event.target.closest('button')) return;
    drag.current = { id: event.pointerId, x: event.clientX - offset.x, y: event.clientY - offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const area = box.current.parentElement.getBoundingClientRect();
    const now = box.current.getBoundingClientRect();
    const left = now.left - offset.x;
    const top = now.top - offset.y;
    setOffset({
      x: Math.min(area.right - now.width - left, Math.max(area.left - left, event.clientX - d.x)),
      y: Math.min(area.bottom - now.height - top, Math.max(area.top - top, event.clientY - d.y)),
    });
  };
  const onUp = () => {
    drag.current = null;
  };
  return (
    <div
      ref={box}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className='absolute bottom-20 right-3 z-20 flex w-40 touch-none justify-end sm:w-52 landscape:bottom-auto landscape:top-3'
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {children}
    </div>
  );
}

// The bar at the bottom of narrower screens, and the sheet it opens.
function PanelSheet({ panels, active, open, onTab, onToggle, hidden }) {
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-3xl bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)] ${hidden ? 'hidden' : ''}`}
    >
      <button type='button' aria-label={open ? 'Close the panel' : 'Open the panel'} onClick={onToggle} className='flex shrink-0 justify-center pb-1 pt-2'>
        <span className='h-1.5 w-12 rounded-full bg-slate-300' aria-hidden='true' />
      </button>
      <div
        role='tablist'
        aria-label='Things for the board'
        className='mx-3 mb-2 grid shrink-0 gap-1 rounded-2xl bg-slate-100 p-1'
        style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }}
      >
        {panels.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={open && active === id}
            onClick={() => onTab(id)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
              open && active === id ? 'bg-violet-600 text-white shadow' : 'text-slate-700 hover:bg-white'
            }`}
          >
            {Icon && <Icon className='h-4 w-4' aria-hidden='true' />}
            {label}
          </button>
        ))}
      </div>
      <div className={`min-h-0 overflow-y-auto px-3 pb-3 ${open ? '' : 'hidden'}`}>
        {panels.map(({ id, content }) => (
          <div key={id} className={id === active ? '' : 'hidden'}>
            {content}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExitFocus({ onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-900'
    >
      <Minimize2 className='h-4 w-4' aria-hidden='true' />
      Exit focus
    </button>
  );
}

export default function WhiteboardLayout({ header, banner, tools, board, call, peerName, panels = [], controls }) {
  const compact = useCompact();
  const [active, setActive] = useState(panels[0]?.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const current = panels.some((p) => p.id === active) ? active : panels[0]?.id;
  if (controls) {
    controls.current = {
      show(id) {
        setActive(id);
        setSheetOpen(true);
      },
      closeSheet() {
        setSheetOpen(false);
      },
      setFocus,
    };
  }

  if (!compact) {
    return (
      <div className='flex h-dvh flex-col bg-slate-200'>
        {!focus && header}
        {!focus && banner}
        <div className='relative flex min-h-0 flex-1 items-start justify-center gap-4 p-4'>
          {tools}
          <main className='wb-board relative min-w-0 rounded-2xl bg-slate-100 shadow' style={BOARD_SHAPE}>
            {board}
          </main>
          <div className={`-m-1 flex max-h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto p-1 xl:w-72 ${focus ? 'hidden' : ''}`}>
            <VideoPanel call={call} peerName={peerName} fill />
            {panels.length > 1 && (
              <div role='tablist' aria-label='Things for the board' className='grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow'>
                {panels.map(({ id, label }) => (
                  <button
                    key={id}
                    type='button'
                    role='tab'
                    aria-selected={current === id}
                    onClick={() => setActive(id)}
                    className={`rounded-xl px-3 py-2 text-sm font-bold ${current === id ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {panels.map(({ id, content }) => (
              <div key={id} className={id === current ? '' : 'hidden'}>
                {content}
              </div>
            ))}
          </div>
          {focus && <ExitFocus onClick={() => setFocus(false)} />}
        </div>
      </div>
    );
  }

  return (
    <div className='relative flex h-dvh flex-col overflow-hidden bg-slate-200'>
      {!focus && header}
      {!focus && banner}
      <div className={`relative min-h-0 flex-1 p-2 ${panels.length && !focus ? 'pb-[5.25rem]' : ''}`}>
        {/* The floating tools and video live in the same space as the board, above the bottom bar. */}
        <div className='relative flex h-full w-full justify-center [container-type:size] portrait:items-start landscape:items-center'>
          <main className='wb-board-fit relative rounded-2xl bg-slate-100 shadow' style={BOARD_SHAPE}>
            {board}
          </main>
          {tools && <FloatingTools tools={tools} focus={focus} />}
          <FloatingVideo>
            <VideoPanel call={call} peerName={peerName} floating collapse={focus} />
          </FloatingVideo>
          {focus && <ExitFocus onClick={() => setFocus(false)} />}
        </div>
      </div>
      {panels.length > 0 && (
        <PanelSheet
          panels={panels}
          active={current}
          open={sheetOpen}
          hidden={focus}
          onToggle={() => setSheetOpen((was) => !was)}
          onTab={(id) => {
            if (sheetOpen && id === current) return setSheetOpen(false);
            setActive(id);
            setSheetOpen(true);
          }}
        />
      )}
    </div>
  );
}
