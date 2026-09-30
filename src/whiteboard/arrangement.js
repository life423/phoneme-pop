import { CELL_WIDTH, STAGE } from './stage.js';

// Which arrangement gives the board the most room on this screen, worked out from the space
// there actually is, never from what the device is:
//  - 'side': tools | board | side column (video, tiles, pictures). Computers, landscape tablets.
//  - 'stacked': tools | board, with tiles and pictures docked below and the video floating in
//    the board's spare space. Tablets held upright.
//  - 'floating': the board fills the screen; tools, video and panels float over it. Phones.
// The numbers are about people, not screens: the room each arrangement's controls take, and
// the smallest alphabet letter a finger can comfortably hit on the board's own strip.
export const SPACE = { header: 64, padding: 24, rail: 96, side: 304, sheet: 0.36 };
export const LETTER_MIN = 22; // screen pixels across one letter of the strip

// How big the board would be (screen pixels per board unit) in the side and stacked arrangements.
export function boardScales(width, height) {
  const tall = height - SPACE.header - SPACE.padding;
  const fit = (w, h) => Math.max(0, Math.min(w / STAGE.width, h / STAGE.height));
  return {
    side: fit(width - SPACE.rail - SPACE.side - SPACE.padding, tall),
    stacked: fit(width - SPACE.rail - SPACE.padding, tall - SPACE.sheet * height),
  };
}

// Side wins ties (within 10%), so computers keep the layout people know.
export function chooseArrangement(width, height) {
  const scale = boardScales(width, height);
  const usable = (s) => s * CELL_WIDTH >= LETTER_MIN;
  if (usable(scale.side) && (!usable(scale.stacked) || scale.side >= scale.stacked * 0.9)) return 'side';
  if (usable(scale.stacked)) return 'stacked';
  return 'floating';
}
