import { useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { Link } from '../router.jsx';

export function TopBar({ back, title, children }) {
  return (
    <header className='flex flex-wrap items-center gap-x-4 gap-y-2 bg-white px-3 py-2 shadow-sm sm:px-4'>
      {back && (
        <Link to={back} aria-label='Back' className='rounded-full p-2 text-violet-700 hover:bg-violet-100'>
          <ArrowLeft className='h-5 w-5' aria-hidden='true' />
        </Link>
      )}
      <h1 className='text-lg font-bold text-violet-800 sm:text-xl'>{title}</h1>
      <div className='flex flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2'>{children}</div>
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
    <span role='status' className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${TONES[tone]}`}>
      <span className='h-2 w-2 rounded-full bg-current' aria-hidden='true' />
      {children}
    </span>
  );
}

export function StageNotice({ children }) {
  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-4'>
      <p className='rounded-full bg-slate-900/80 px-5 py-2 text-center text-base font-semibold text-white shadow-lg'>{children}</p>
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
