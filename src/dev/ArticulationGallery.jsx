import { ARTICULATION_CARDS, soundLabel } from '../data/articulationCards.js';

// A developer page (/dev/articulation): every articulation SVG side by side at the same size,
// to spot inconsistencies at a glance.
const FILES = import.meta.glob('../assets/articulation/*.svg', { eager: true, query: '?url', import: 'default' });
const fileFor = (id) => FILES[`../assets/articulation/${id}.svg`];

export default function ArticulationGallery() {
  return (
    <main className='min-h-dvh bg-slate-50 px-4 py-8 sm:px-8'>
      <h1 className='text-2xl font-extrabold text-slate-900'>Articulation gallery</h1>
      <p className='mt-1 text-slate-600'>{ARTICULATION_CARDS.length} poses, one shared anatomy. Developer view.</p>
      <ul className='mt-6 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]'>
        {ARTICULATION_CARDS.map((card) => (
          <li key={card.id} className='rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200'>
            <div className='overflow-hidden rounded-xl ring-2 ring-slate-900'>
              <img src={fileFor(card.id)} width='400' height='400' alt={`${card.title} side view`} className='block aspect-square h-auto w-full bg-white' />
            </div>
            <p className='mt-3 text-xs font-bold uppercase tracking-wider text-violet-600'>{card.name}</p>
            <p className='text-lg font-bold text-slate-900'>{card.title}</p>
            <p className='mt-1 flex flex-wrap gap-1.5'>
              {card.sounds.map((s) => (
                <span key={s} className='rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-700'>{soundLabel(s)}</span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
