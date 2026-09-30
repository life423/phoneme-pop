import { describe, expect, it } from 'vitest';
import { CELL_WIDTH } from './stage.js';
import { LETTER_MIN, boardScales, chooseArrangement } from './arrangement.js';

const sizes = (list) => list.map(([name, w, h]) => ({ name, w, h }));

describe('choosing the layout from the space there is', () => {
  it('gives phones, either way up, the phone layout', () => {
    for (const { name, w, h } of sizes([
      ['iPhone SE', 375, 667],
      ['iPhone 16', 393, 852],
      ['iPhone 16 Pro Max', 440, 956],
      ['Pixel 8', 412, 915],
      ['Galaxy S24', 360, 780],
      ['small phone', 320, 568],
      ['folding phone, closed', 280, 653],
      ['iPhone 16 on its side', 852, 393],
      ['Pro Max on its side', 956, 440],
      ['Galaxy on its side', 780, 360],
      ['one-third Split View', 320, 1024],
    ])) expect([name, chooseArrangement(w, h)]).toEqual([name, 'floating']);
  });

  it('gives tablets held upright, of any make, the tablet layout', () => {
    for (const { name, w, h } of sizes([
      ['iPad mini', 744, 1133],
      ['iPad', 820, 1180],
      ['iPad Pro 11', 834, 1210],
      ['iPad Pro 13', 1024, 1366],
      ['older iPad', 768, 1024],
      ['Galaxy Tab S4', 712, 1138],
      ['Galaxy Tab / Fire HD 10', 800, 1280],
      ['Pixel Tablet', 800, 1280],
      ['folding phone, open', 884, 1104],
    ])) expect([name, chooseArrangement(w, h)]).toEqual([name, 'stacked']);
  });

  it('gives computers and tablets on their side the side-by-side layout', () => {
    for (const { name, w, h } of sizes([
      ['iPad on its side', 1180, 820],
      ['iPad mini on its side', 1133, 744],
      ['iPad Pro 13 on its side', 1366, 1024],
      ['older iPad on its side', 1024, 768],
      ['Pixel Tablet on its side', 1280, 800],
      ['small laptop', 1280, 720],
      ['laptop', 1440, 900],
      ['desktop', 1920, 1080],
      ['big monitor', 2560, 1440],
      ['4K monitor', 3840, 2160],
    ])) expect([name, chooseArrangement(w, h)]).toEqual([name, 'side']);
  });

  it('only ever picks an arrangement whose letters are big enough, at every size', () => {
    for (let w = 280; w <= 3840; w += 20) {
      for (let h = 400; h <= 2160; h += 40) {
        const arrangement = chooseArrangement(w, h);
        if (arrangement === 'floating') continue; // phones zoom in and use the alphabet bar
        expect(boardScales(w, h)[arrangement] * CELL_WIDTH).toBeGreaterThanOrEqual(LETTER_MIN);
      }
    }
  });
});
