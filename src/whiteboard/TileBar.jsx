import { useEffect, useRef, useState } from 'react';
import { BOX_COUNTS, MAX_TILES } from '../../shared/tiles.js';

// The tutor's tile controls, under the board: add tiles, change a selected one,
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
    <div className='flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2 shadow'>
      <form onSubmit={submit} className='flex min-w-[16rem] flex-1 items-center gap-2'>
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
          placeholder={selected ? `Change “${selected.text}” to…` : 'Add tiles, spaces between: sh i p'}
          autoComplete='off'
          autoCapitalize='off'
          spellCheck={false}
          className='min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-lg text-slate-900 focus:border-violet-500 focus:outline-none'
        />
        <button type='submit' className={`${pill} bg-violet-600 text-white hover:bg-violet-700`}>
          {selected ? 'Change' : 'Add'}
        </button>
        {selected && (
          <button type='button' onClick={onCancelEdit} className={`${pill} text-slate-600 hover:bg-slate-100`}>
            Cancel
          </button>
        )}
      </form>
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
      <span className='text-xs font-semibold text-slate-500'>
        {count}/{MAX_TILES}
      </span>
      <div className='flex items-center gap-1' role='group' aria-label='Sound boxes'>
        <span className='mr-1 text-sm font-semibold text-slate-600'>Sound boxes</span>
        {BOX_COUNTS.map((n) => (
          <button
            key={n}
            type='button'
            aria-pressed={boxes === n}
            onClick={() => onBoxes(n)}
            className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-bold ${
              boxes === n ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-violet-50'
            }`}
          >
            {n === 0 ? 'Off' : n}
          </button>
        ))}
      </div>
      {note && (
        <span role='status' className='text-sm font-semibold text-amber-700'>
          {note}
        </span>
      )}
    </div>
  );
}
