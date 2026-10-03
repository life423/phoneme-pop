import ArticulationCard, { photoStatus } from '../articulation/ArticulationCard.jsx';
import { MOUTH_REGION } from '../articulation/cardLayout.js';
import { ARTICULATION_CARDS, FRONT_PHOTOS, FRONT_PHOTO_STAND_INS, soundLabel } from '../data/articulationCards.js';

function PhotoStatus({ photoKey }) {
  const status = photoStatus(photoKey);
  if (status === 'photo') return <span className='text-emerald-700'>{photoKey}: photo</span>;
  if (status === 'stand-in') return <span className='text-sky-700'>{photoKey}: closest photo ({FRONT_PHOTO_STAND_INS[photoKey]})</span>;
  return <span className='rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white'>MISSING PHOTO: {photoKey}</span>;
}

// A developer page (/dev/articulation-cards): all 16 complete cards side by side.
export default function ArticulationCardsGallery() {
  const m = MOUTH_REGION;
  const missing = Object.keys(FRONT_PHOTOS).filter((key) => photoStatus(key) === 'missing');
  return (
    <main className='min-h-dvh bg-slate-100 px-4 py-8 sm:px-8'>
      <h1 className='text-2xl font-extrabold text-slate-900'>Articulation cards</h1>
      <p className='mt-1 text-slate-600'>
        {ARTICULATION_CARDS.length} cards, 1200 × 1200. Mouth region for Magic Select: x {m.x}, y {m.y}, {m.w} × {m.h}, radius {m.r}.
      </p>
      <p className={`mt-2 text-sm font-semibold ${missing.length ? 'text-red-700' : 'text-emerald-700'}`}>
        {missing.length ? `Missing photos: ${missing.join(', ')}` : 'Every photo group has a photo.'}
      </p>
      <ul className='mt-6 grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))]'>
        {ARTICULATION_CARDS.map((card, i) => (
          <li key={card.id}>
            <ArticulationCard card={card} className='block h-auto w-full drop-shadow-sm' />
            <p className='mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-600'>
              <span className='font-semibold text-slate-800'>
                {i + 1}. {card.name}
              </span>
              <span>{card.sounds.map(soundLabel).join(' ')}</span>
              <PhotoStatus photoKey={card.frontPhotoKey} />
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
