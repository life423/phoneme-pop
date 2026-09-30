import { useRef } from 'react';
import { Pointer } from 'lucide-react';
import { CELL_WIDTH, LETTERS, STRIP } from './stage.js';

// The alphabet on phones: two rows of 13, pinned above the zoomable board and sized to the
// screen, so every letter is always in view. The board's own one-row strip is still there
// (the tutor's screen shows it); pointing at a letter here puts the hand on that letter
// there, and the other person's pointing lights up here. A small hand sits on each pointed-at
// letter (violet for the student, blue for the tutor), so the hand seems to move up into the bar.
const ROWS = [LETTERS.slice(0, 13), LETTERS.slice(13)];

// Where a letter sits on the shared board's strip.
export const letterPoint = (letter) => {
  const i = LETTERS.indexOf(letter);
  return { x: STRIP.x + (i + 0.5) * CELL_WIDTH, y: STRIP.y + STRIP.height / 2, letter };
};

// The same colours as the board: the student's letter violet, the tutor's blue.
function tone(letter, letters) {
  const student = letter === letters.student;
  const tutor = letter === letters.tutor;
  if (!student && !tutor) return 'border-slate-200 bg-white text-slate-800';
  return `${student ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800'} ${tutor ? 'border-blue-500' : 'border-violet-500'} border-2`;
}

export default function AlphabetBar({ letters = {}, onPoint }) {
  const pressing = useRef(null);
  const point = (event) => {
    const letter = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-letter]')?.dataset.letter;
    if (letter) onPoint?.(letterPoint(letter));
  };
  return (
    <div
      role='group'
      aria-label='Alphabet'
      className='grid shrink-0 touch-none select-none gap-1 rounded-2xl bg-white p-1.5 shadow'
      onPointerDown={(event) => {
        if (!onPoint) return;
        pressing.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // works without capture too
        }
        point(event);
      }}
      onPointerMove={(event) => {
        if (pressing.current === event.pointerId) point(event);
      }}
      onPointerUp={() => {
        pressing.current = null;
      }}
      onPointerCancel={() => {
        pressing.current = null;
      }}
    >
      {ROWS.map((row, r) => (
        <div key={r} className='grid gap-1' style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
          {row.map((letter) => (
            <span
              key={letter}
              data-letter={letter}
              className={`relative flex h-9 items-center justify-center rounded-lg border text-lg font-extrabold sm:h-12 sm:rounded-xl sm:text-2xl ${tone(letter, letters)}`}
            >
              {letter}
              {(letter === letters.student || letter === letters.tutor) && (
                <span className='pointer-events-none absolute -right-1.5 -top-1.5 flex' aria-hidden='true'>
                  {letter === letters.student && <Pointer className='hand-student h-4 w-4 rounded-full bg-white p-px text-violet-700 shadow sm:h-5 sm:w-5' />}
                  {letter === letters.tutor && <Pointer className='hand-tutor h-4 w-4 rounded-full bg-white p-px text-blue-600 shadow sm:h-5 sm:w-5' />}
                </span>
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
