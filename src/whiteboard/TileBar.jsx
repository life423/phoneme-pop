import { useEffect, useRef, useState } from 'react';
import { BOX_COUNTS, MAX_TILES } from '../../shared/tiles.js';

// The tutor's tile controls, a card in the side column: add tiles, change a selected one,
// send them all home, clear them, and set the sound boxes.
export default function TileBar({ count, selected, onAdd, onEdit, onCancelEdit, onReset, onClear, boxes, onBoxes }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState(null);
  const [armed, setArmed] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!selected) return;
    setText('');
    inputRef.current?.focus();
  }, [selected?.id]);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  useEffect(() => {
    if (!note) return undefined;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  const submit = (event) => {
    event.preventDefault();
    if (selected) {
      if (onEdit(text)) setText('');
      else setNote('Letters only, up to 4');
      return;
    }
    const { added, skipped, full } = onAdd(text);
    if (added) setText('');
    if (skipped) setNote(`Skipped ${skipped}: letters only, up to 4 each`);
    else if (full) setNote(`That’s the ${MAX_TILES}-tile limit`);
  };

  const pill = 'rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-40';

  return (
    <section aria-label='Letter tiles' className='flex flex-col gap-3 rounded-2xl bg-white p-3 shadow'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-bold text-slate-700'>Letter tiles</h2>
        <span className='text-xs font-semibold text-slate-500'>
          {count}/{MAX_TILES}
        </span>
      </div>
      <form onSubmit={submit} className='flex items-center gap-2'>
        <label htmlFor='tile-input' className='sr-only'>
          {selected ? 'Change the selected tile' : 'Add tiles'}
        </label>
        <input
          id='tile-input'
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && selected) onCancelEdit();
          }}
          placeholder={selected ? `“${selected.text}” to…` : 'sh i p'}
          autoComplete='off'
          autoCapitalize='off'
          spellCheck={false}
          className='min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-lg text-slate-900 focus:border-violet-500 focus:outline-none'
        />
        <button type='submit' className={`${pill} bg-violet-600 text-white hover:bg-violet-700`}>
          {selected ? 'Change' : 'Add'}
        </button>
      </form>
      <p className='-mt-1 text-xs text-slate-500'>
        {selected ? (
          <>
            Type the new letters, or{' '}
            <button type='button' onClick={onCancelEdit} className='font-semibold text-violet-700 underline'>
              cancel
            </button>
            .
          </>
        ) : (
          'Spaces between tiles. Click a tile to change it.'
        )}
      </p>
      <div className='grid grid-cols-2 gap-2'>
        <button type='button' onClick={onReset} disabled={!count} className={`${pill} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
          Back to tray
        </button>
        <button
          type='button'
          disabled={!count}
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            onClear();
          }}
          className={`${pill} ${armed ? 'bg-rose-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {armed ? 'Sure?' : 'Clear tiles'}
        </button>
      </div>
      <div>
        <p id='sound-boxes-label' className='mb-1.5 text-xs font-semibold text-slate-600'>
          Sound boxes
        </p>
        <div role='group' aria-labelledby='sound-boxes-label' className='grid grid-cols-5 gap-1'>
          {BOX_COUNTS.map((n) => (
            <button
              key={n}
              type='button'
              aria-pressed={boxes === n}
              onClick={() => onBoxes(n)}
              className={`rounded-lg py-1.5 text-sm font-bold ${boxes === n ? 'bg-violet-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-violet-50'}`}
            >
              {n === 0 ? 'Off' : n}
            </button>
          ))}
        </div>
      </div>
      {note && (
        <p role='status' className='text-xs font-semibold text-amber-700'>
          {note}
        </p>
      )}
    </section>
  );
}
