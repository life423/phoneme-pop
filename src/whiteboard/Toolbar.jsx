import { useEffect, useState } from 'react';

export function ToolRail({ label, children }) {
  return (
    <nav
      aria-label={label}
      className='flex shrink-0 flex-col justify-center gap-1 self-center rounded-2xl bg-white p-1.5 shadow max-lg:portrait:flex-row lg:gap-1.5 lg:p-2'
    >
      {children}
    </nav>
  );
}

export function ToolButton({ icon: Icon, label, pressed, disabled = false, danger = false, swatch, onClick }) {
  let tone = 'text-slate-700 hover:bg-violet-50';
  if (danger) tone = 'bg-rose-600 text-white';
  else if (pressed) tone = 'bg-violet-600 text-white shadow';
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={label}
      className={`flex w-11 flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-bold transition-colors disabled:opacity-30 sm:w-14 lg:w-16 ${tone}`}
    >
      <span className='relative'>
        <Icon className='h-6 w-6' aria-hidden='true' />
        {swatch && (
          <span
            className='absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white'
            style={{ backgroundColor: swatch }}
          />
        )}
      </span>
      <span className='max-sm:sr-only'>{label}</span>
    </button>
  );
}

// Clearing needs a second tap within three seconds, so it never happens by accident.
export function ClearButton({ icon, onClear }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <ToolButton
      icon={icon}
      label={armed ? 'Sure?' : 'Clear'}
      danger={armed}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onClear();
      }}
    />
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className='inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
    >
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
      {label}
    </button>
  );
}
