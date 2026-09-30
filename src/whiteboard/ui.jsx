import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Maximize2, MoreHorizontal, X } from 'lucide-react';
import { Link } from '../router.jsx';

// The header. `children` are the essentials, always shown. `menu` holds the session controls:
// in the bar on wide screens, behind a settings button on narrower ones. `end` (End session,
// Leave) sits at the far right, and on phones moves into the menu to leave room for the title.
export function TopBar({ back, title, children, menu, end }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const room = Boolean(menu || end);
  return (
    <header
      ref={ref}
      className={`relative z-30 flex items-center gap-x-3 gap-y-2 bg-white px-3 py-2 shadow-sm sm:px-4 ${room ? '2xl:flex-wrap 2xl:gap-x-4' : 'flex-wrap gap-x-4'}`}
    >
      {back && (
        <Link to={back} aria-label='Back' className='rounded-full p-2 text-violet-700 hover:bg-violet-100'>
          <ArrowLeft className='h-5 w-5' aria-hidden='true' />
        </Link>
      )}
      <h1 className={`text-lg font-bold text-violet-800 sm:text-xl ${room ? 'min-w-0 truncate max-sm:text-base' : 'shrink-0'}`}>{title}</h1>
      <div
        className={`flex items-center justify-end gap-x-2 gap-y-2 sm:gap-x-4 ${
          room ? 'ml-auto shrink-0 2xl:min-w-0 2xl:flex-1 2xl:shrink 2xl:flex-wrap' : 'min-w-0 flex-1 flex-wrap'
        }`}
      >
        {children}
        {menu && <div className='hidden items-center gap-x-4 gap-y-2 2xl:flex 2xl:flex-wrap'>{menu}</div>}
        {menu && (
          <button
            type='button'
            aria-expanded={open}
            aria-label='Session menu'
            title='Session menu'
            onClick={() => setOpen((was) => !was)}
            className={`rounded-full p-2 2xl:hidden ${open ? 'bg-violet-100 text-violet-800' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <MoreHorizontal className='h-5 w-5' aria-hidden='true' />
          </button>
        )}
        {end && <div className='max-sm:hidden'>{end}</div>}
      </div>
      {menu && open && (
        <div className='absolute right-2 top-full z-40 mt-2 flex w-72 max-w-[calc(100vw-1rem)] flex-col items-start gap-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 2xl:hidden'>
          {menu}
          {end && <div className='sm:hidden'>{end}</div>}
        </div>
      )}
    </header>
  );
}

const TONES = {
  good: 'bg-emerald-100 text-emerald-800',
  wait: 'bg-amber-100 text-amber-900',
  bad: 'bg-rose-100 text-rose-800',
};

export function StatusPill({ tone, children }) {
  return (
    <span
      role='status'
      title={typeof children === 'string' ? children : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-2 text-sm font-semibold sm:px-3 sm:py-1 ${TONES[tone]}`}
    >
      <span className='h-2 w-2 rounded-full bg-current' aria-hidden='true' />
      {/* On phones just the coloured dot shows; the words stay for screen readers. */}
      <span className='max-sm:sr-only'>{children}</span>
    </span>
  );
}

// Focus mode: just the board, with everything else tucked away.
export function FocusButton({ onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50'
    >
      <Maximize2 className='h-4 w-4' aria-hidden='true' />
      Focus mode
    </button>
  );
}

// A message over the board. Its X closes it, and it stays closed until the message changes.
export function StageNotice({ children }) {
  const text = [].concat(children).join('');
  const [closed, setClosed] = useState(null);
  if (closed === text) return null;
  return (
    <div className='pointer-events-none absolute inset-x-0 top-[22%] z-10 flex justify-center px-3 sm:px-4'>
      <p className='pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-900/80 py-1.5 pl-3 pr-1.5 text-center text-sm font-semibold text-white shadow-lg sm:rounded-full sm:py-2 sm:pl-5 sm:pr-2 sm:text-base'>
        <span>{children}</span>
        <button
          type='button'
          onClick={() => setClosed(text)}
          aria-label='Close this message'
          title='Close'
          className='shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white'
        >
          <X className='h-4 w-4' aria-hidden='true' />
        </button>
      </p>
    </div>
  );
}

export function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', text);
    }
  };
  return (
    <button
      type='button'
      onClick={copy}
      className='inline-flex items-center gap-1 rounded-full border border-violet-300 px-3 py-1 text-sm font-semibold text-violet-700 hover:bg-violet-50'
    >
      {copied ? <Check className='h-4 w-4' aria-hidden='true' /> : <Copy className='h-4 w-4' aria-hidden='true' />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

export function MessageScreen({ title, children }) {
  return (
    <div className='flex min-h-dvh items-center justify-center bg-gradient-to-b from-violet-50 to-sky-50 p-6'>
      <div className='max-w-md rounded-3xl bg-white p-8 text-center shadow-lg'>
        <h1 className='text-2xl font-bold text-slate-900'>{title}</h1>
        <p className='mt-3 text-base text-slate-600'>{children}</p>
        <Link to='/whiteboard' className='mt-6 inline-block rounded-full bg-violet-600 px-6 py-3 font-bold text-white hover:bg-violet-700'>
          Back to the whiteboard
        </Link>
      </div>
    </div>
  );
}
