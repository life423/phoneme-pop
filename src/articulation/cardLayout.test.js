import { describe, expect, it } from 'vitest';
import { ARTICULATION_CARDS, FRONT_PHOTOS, cardSoundLine } from '../data/articulationCards.js';
import { BANNER, CARD, COLUMN, DIAGRAM, INSTRUCTION, MOUTH_REGION, PHOTO, SOUND, fitText, titleSize } from './cardLayout.js';

describe('the articulation card layout', () => {
  it('keeps the mouth photo in one place, clear of everything else', () => {
    expect(PHOTO.y - (BANNER.y + BANNER.height)).toBeGreaterThanOrEqual(30);
    expect(COLUMN.x - (PHOTO.x + PHOTO.width)).toBeGreaterThanOrEqual(30);
    expect(CARD.height - (PHOTO.y + PHOTO.height)).toBeGreaterThanOrEqual(30);
    expect(MOUTH_REGION).toMatchObject({ id: 'mouth', x: 48, y: 300, w: 744, h: 852 });
  });

  it('fits the diagram and text inside the right column', () => {
    expect(DIAGRAM.x).toBeGreaterThanOrEqual(COLUMN.x);
    expect(DIAGRAM.x + DIAGRAM.size).toBeLessThanOrEqual(COLUMN.x + COLUMN.width);
    expect(INSTRUCTION.y + INSTRUCTION.height).toBeLessThanOrEqual(DIAGRAM.y);
    expect(DIAGRAM.y + DIAGRAM.size).toBeLessThanOrEqual(SOUND.y);
  });

  it('fits every card title, instruction and sound line', () => {
    for (const card of ARTICULATION_CARDS) {
      expect([card.id, titleSize(card.title) >= 80]).toEqual([card.id, true]);
      for (const [text, area] of [[card.instruction, INSTRUCTION], [cardSoundLine(card), SOUND]]) {
        const { size, lines } = fitText(text, { height: area.height });
        expect([card.id, text, lines.length * size * 1.2 <= area.height]).toEqual([card.id, text, true]);
      }
    }
  });
});

describe('the shared front-mouth photos', () => {
  it('groups the cards by visible mouth shape, as planned', () => {
    const groups = {};
    for (const card of ARTICULATION_CARDS) (groups[card.frontPhotoKey] ||= []).push(card.id);
    expect(groups).toEqual({
      'lips-closed': ['bilabial-closed'],
      'lip-to-teeth': ['labiodental'],
      'tongue-between-teeth': ['interdental'],
      'neutral-open': ['alveolar-stop', 'lateral-l', 'velar', 'glottal-h', 'palatal-y'],
      'teeth-close': ['alveolar-fricative'],
      'slightly-rounded': ['postalveolar', 'postalveolar-affricate'],
      'strongly-rounded': ['rounded-w', 'vowel-rounded-back'],
      rhotic: ['rhotic-r'],
      'smile-vowel': ['vowel-front'],
      'open-vowel': ['vowel-open'],
    });
    expect(Object.keys(groups).sort()).toEqual(Object.keys(FRONT_PHOTOS).sort());
  });
});
