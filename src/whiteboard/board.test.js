import { describe, expect, it } from 'vitest';
import { Board, STUDENT_LAYER, TUTOR_LAYER } from './board.js';

const stroke = (id, by, seq) => ({ id, by, tool: 'pen', pts: [10, 10], seq });

describe('Board', () => {
  it('keeps strokes in server order, even when a local stroke learns its place later', () => {
    const board = new Board();
    board.add(stroke('mine', 'student'));
    board.add(stroke('theirs', 'tutor', 5));
    expect(board.strokes.map((s) => s.id)).toEqual(['theirs', 'mine']);
    board.setSeq('mine', 4);
    expect(board.strokes.map((s) => s.id)).toEqual(['mine', 'theirs']);
  });

  it('finds your latest stroke for undo, and forgets removed ones', () => {
    const board = new Board();
    board.add(stroke('a', 'student', 1));
    board.add(stroke('b', 'tutor', 2));
    board.add(stroke('c', 'student', 3));
    expect(board.lastBy('student').id).toBe('c');
    board.remove('c');
    expect(board.lastBy('student').id).toBe('a');
    expect(board.lastBy('nobody')).toBeNull();
  });

  it('tells the canvas what to draw', () => {
    const board = new Board();
    const events = [];
    board.subscribe((event) => events.push(event.type));
    board.add(stroke('a', 'tutor', 1));
    board.append('a', [20, 20]);
    board.finish('a');
    board.append('a', [30, 30]); // finished strokes don't grow
    board.replace([]);
    expect(events).toEqual(['segment', 'segment', 'redraw', 'redraw']);
    expect(board.strokes).toEqual([]);
  });
});

describe('ink layers', () => {
  it('keeps the student’s eraser off the tutor’s writing', () => {
    const strokes = [
      { by: 'tutor', tool: 'pen' },
      { by: 'tutor', tool: 'eraser' },
      { by: 'student', tool: 'pen' },
      { by: 'student', tool: 'eraser' },
    ];
    expect(strokes.map(TUTOR_LAYER)).toEqual([true, true, false, false]);
    expect(strokes.map(STUDENT_LAYER)).toEqual([false, true, true, true]);
  });
});
