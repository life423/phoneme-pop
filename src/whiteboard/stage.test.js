import { describe, expect, it } from 'vitest';
import { BOARD, CELL_WIDTH, STRIP, isRoomCode, letterAt } from './stage.js';

const middleOf = (i) => STRIP.x + CELL_WIDTH * (i + 0.5);
const stripY = STRIP.y + STRIP.height / 2;

describe('letterAt', () => {
  it('finds the letter under the fingertip', () => {
    expect(letterAt(middleOf(0), stripY)).toBe('A');
    expect(letterAt(middleOf(12), stripY)).toBe('M');
    expect(letterAt(middleOf(25), stripY)).toBe('Z');
  });

  it('is empty anywhere off the strip', () => {
    expect(letterAt(middleOf(12), BOARD.y + 100)).toBeNull();
    expect(letterAt(STRIP.x - 5, stripY)).toBeNull();
    expect(letterAt(STRIP.x + STRIP.width + 5, stripY)).toBeNull();
  });
});

describe('isRoomCode', () => {
  it('accepts exactly four digits', () => {
    expect(isRoomCode('4827')).toBe(true);
    for (const bad of ['482', '48270', 'abcd', '48 7', '', null]) expect(isRoomCode(bad)).toBe(false);
  });
});

describe('alphabet strip', () => {
  it('points at nothing while the strip is hidden', () => {
    expect(letterAt(middleOf(12), stripY, false)).toBeNull();
  });
});
