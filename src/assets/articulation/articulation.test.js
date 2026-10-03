import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHARED_PATHS, VIEW_BOX } from './anatomy.js';
import { POSES } from './poses.js';
import { articulationSvg } from './svg.js';
import { ARTICULATION_CARDS, articulationPoses, cardSoundLine } from '../../data/articulationCards.js';

const ALLOWED = new Set(['id', 'title', 'jaw', 'upperLip', 'lowerLip', 'tongue', 'tongueHighlight', 'contacts', 'airflow']);
const count = (text, part) => text.split(part).length - 1;

describe('the articulation library', () => {
  it('has the 16 base poses, one per card', () => {
    expect(POSES).toHaveLength(16);
    expect(new Set(POSES.map((p) => p.id)).size).toBe(16);
    expect(ARTICULATION_CARDS.map((c) => c.id)).toEqual(POSES.map((p) => p.id));
  });

  it('lets a pose change only its tongue, lips, jaw opening, contacts and airflow', () => {
    for (const pose of POSES) for (const key of Object.keys(pose)) expect([pose.id, key, ALLOWED.has(key)]).toEqual([pose.id, key, true]);
  });

  it('draws the same anatomy, from the one shared set of paths, in every pose', () => {
    for (const pose of POSES) {
      const svg = articulationSvg(pose);
      expect(svg).toContain(`viewBox='${VIEW_BOX}'`);
      for (const [name, d] of Object.entries(SHARED_PATHS)) expect([pose.id, name, count(svg, `d='${d}'`)]).toEqual([pose.id, name, 1]);
    }
  });

  it('keeps the SVG files up to date with the anatomy and poses (npm run articulation)', () => {
    for (const pose of POSES) {
      expect(readFileSync(new URL(`./${pose.id}.svg`, import.meta.url), 'utf8')).toBe(articulationSvg(pose));
    }
  });

  it('maps every sound to a card, and every card sound to a mapping', () => {
    const ids = new Set(ARTICULATION_CARDS.map((c) => c.id));
    for (const [sound, info] of Object.entries(articulationPoses)) expect([sound, ids.has(info.card)]).toEqual([sound, true]);
    for (const card of ARTICULATION_CARDS) for (const s of card.sounds) expect([s, articulationPoses[s]?.card]).toEqual([s, card.id]);
    expect(cardSoundLine(ARTICULATION_CARDS[1])).toBe('Makes the /f/ and /v/ sounds.');
    expect(cardSoundLine(ARTICULATION_CARDS[0])).toBe('Makes the /p/, /b/ and /m/ sounds.');
  });
});
