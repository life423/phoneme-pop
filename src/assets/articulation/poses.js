// The 16 base articulation poses. Each supplies only what changes: its tongue, lips, jaw
// opening (degrees the shared jaw rotates open), contact markers and airflow arrows.
// Everything else is the shared anatomy in anatomy.js. To add a pose, add an entry here.

const r1 = (n) => Math.round(n * 10) / 10;

// Airflow arrows: straight, or curved through a control point.
function head([x, y], angle) {
  const point = (turn) => `${r1(x - 11 * Math.cos(angle + turn))} ${r1(y - 11 * Math.sin(angle + turn))}`;
  return `M ${point(0.55)} L ${x} ${y} L ${point(-0.55)}`;
}
export const arrow = ([x1, y1], [x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2} ${head([x2, y2], Math.atan2(y2 - y1, x2 - x1))}`;
export const curvedArrow = ([x1, y1], [cx, cy], [x2, y2]) =>
  `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2} ${head([x2, y2], Math.atan2(y2 - cy, x2 - cx))}`;

// Lips. The upper lip starts where the profile ends; the lower lip moves with the jaw.
const UPPER = {
  closed: 'M 112 96 C 102 102 94 112 94 124 C 94 136 102 144 114 147 C 126 150 138 150 150 148 C 148 132 138 112 122 98 Z',
  raised: 'M 112 96 C 102 102 94 112 94 122 C 94 131 100 137 110 139 C 120 140 130 137 138 132 C 136 118 130 106 122 98 Z',
  rounded: 'M 112 96 C 98 100 82 110 78 124 C 76 134 82 142 94 145 C 106 147 120 146 132 144 C 132 128 126 110 120 98 Z',
  spread: 'M 112 96 C 106 102 102 112 102 120 C 102 128 108 134 118 136 C 128 138 138 136 146 134 C 144 120 136 106 124 98 Z',
};
const LOWER = {
  closed: 'M 114 148 C 126 148 140 150 152 152 C 152 168 142 186 126 193 C 112 198 100 190 97 178 C 94 164 102 150 114 148 Z',
  tucked: 'M 128 156 C 138 152 150 152 160 154 C 162 170 152 188 136 194 C 120 198 106 190 104 178 C 104 166 114 158 128 156 Z',
  rounded: 'M 96 150 C 108 148 122 150 132 152 C 134 168 126 184 112 190 C 98 194 86 186 84 174 C 82 162 86 152 96 150 Z',
  spread: 'M 118 152 C 128 152 140 152 150 154 C 150 166 142 178 130 182 C 118 186 108 180 106 170 C 104 160 108 152 118 152 Z',
};

// Tongues: [shape, highlight]. Their bottoms run under the jaw, which hides them.
const TONGUE = {
  rest: [
    'M 180 176 C 188 162 208 152 234 148 C 282 142 332 150 362 170 C 382 184 396 208 402 236 L 410 280 L 190 280 C 180 240 174 196 180 176 Z',
    'M 204 160 C 232 152 282 151 330 162',
  ],
  ridge: [
    'M 172 122 C 176 108 186 101 196 103 C 210 107 222 121 240 131 C 280 141 330 149 362 168 C 382 182 396 206 402 236 L 410 280 L 190 280 C 178 240 166 160 172 122 Z',
    'M 204 118 C 226 130 284 140 330 156',
  ],
  nearRidge: [
    'M 176 130 C 180 120 188 114 198 116 C 212 120 224 130 242 138 C 282 146 330 152 362 170 C 382 184 396 208 402 236 L 410 280 L 190 280 C 180 240 170 168 176 130 Z',
    'M 206 128 C 228 138 284 146 330 160',
  ],
  between: [
    'M 136 166 C 136 158 146 156 160 158 C 190 160 214 154 240 150 C 286 144 334 152 364 172 C 384 186 397 210 402 238 L 410 280 L 190 280 C 184 230 170 196 150 178 C 140 174 136 172 136 166 Z',
    'M 170 162 C 210 156 280 150 332 164',
  ],
  postRidge: [
    'M 182 150 C 188 134 202 120 222 110 C 240 102 262 104 280 114 C 316 132 346 150 366 170 C 384 186 397 210 402 238 L 410 280 L 190 280 C 182 230 176 180 182 150 Z',
    'M 214 124 C 236 112 268 112 300 130',
  ],
  postRidgeTouch: [
    'M 180 144 C 186 126 200 108 220 96 C 238 88 262 92 282 106 C 316 128 346 148 366 170 C 384 186 397 210 402 238 L 410 280 L 190 280 C 180 230 174 176 180 144 Z',
    'M 210 112 C 232 100 266 102 300 124',
  ],
  back: [
    'M 180 178 C 190 168 208 162 232 160 C 270 156 300 140 326 120 C 342 108 360 106 372 116 C 388 130 398 160 402 200 L 410 280 L 190 280 C 180 240 174 198 180 178 Z',
    'M 214 168 C 260 162 300 146 336 122',
  ],
  backHigh: [
    'M 182 182 C 192 172 210 166 234 164 C 270 160 300 148 322 132 C 338 122 356 120 368 130 C 384 144 396 170 402 206 L 410 280 L 190 280 C 180 240 176 200 182 182 Z',
    'M 216 172 C 260 166 298 152 330 134',
  ],
  bunched: [
    'M 186 160 C 190 146 202 138 214 140 C 230 144 240 156 258 150 C 290 138 320 132 344 142 C 370 154 390 180 400 214 L 410 280 L 190 280 C 182 230 180 180 186 160 Z',
    'M 262 158 C 292 146 318 142 340 150',
  ],
  palatal: [
    'M 180 172 C 190 156 210 140 236 126 C 260 112 290 108 314 118 C 342 130 362 150 376 170 C 390 190 400 214 404 240 L 410 280 L 190 280 C 180 240 174 196 180 172 Z',
    'M 220 142 C 246 124 286 118 318 130',
  ],
  frontHigh: [
    'M 180 170 C 190 152 212 136 240 128 C 266 120 294 122 316 132 C 342 144 362 160 378 180 C 392 198 401 220 404 244 L 410 280 L 190 280 C 180 240 174 194 180 170 Z',
    'M 220 146 C 248 132 288 128 320 140',
  ],
  low: [
    'M 186 226 C 196 212 216 204 242 200 C 288 194 334 200 362 214 C 382 226 396 246 402 268 L 410 310 L 190 310 C 184 268 180 236 186 226 Z',
    'M 214 212 C 250 204 300 202 340 212',
  ],
  lowMid: [
    'M 184 200 C 194 188 214 182 240 178 C 286 172 332 180 360 196 C 380 210 394 230 400 254 L 410 290 L 190 290 C 182 250 178 214 184 200 Z',
    'M 212 188 C 248 180 298 180 338 192',
  ],
};

// Airflow out of the front of the mouth: three short arrows, like the Lip Biter card.
const outFront = (x, y) => [arrow([x, y - 12], [x - 30, y - 22]), arrow([x, y], [x - 34, y]), arrow([x, y + 12], [x - 30, y + 22])];

function pose(id, title, { jaw, upper, lower, tongue, contacts = [], airflow = [] }) {
  const [shape, highlight] = TONGUE[tongue];
  return { id, title, jaw, upperLip: UPPER[upper], lowerLip: LOWER[lower], tongue: shape, tongueHighlight: highlight, contacts, airflow };
}

export const POSES = [
  pose('bilabial-closed', 'Lip Popper', { jaw: 0, upper: 'closed', lower: 'closed', tongue: 'rest', contacts: [{ x: 104, y: 148 }] }),
  pose('labiodental', 'Lip Biter', { jaw: 1, upper: 'raised', lower: 'tucked', tongue: 'rest', contacts: [{ x: 150, y: 154 }], airflow: outFront(96, 156) }),
  pose('interdental', 'Tongue Peeker', { jaw: 3, upper: 'raised', lower: 'closed', tongue: 'between', airflow: outFront(118, 166) }),
  pose('alveolar-stop', 'Tongue Tapper', { jaw: 2, upper: 'closed', lower: 'closed', tongue: 'ridge', contacts: [{ x: 190, y: 104 }] }),
  pose('alveolar-fricative', 'Snake Sound', {
    jaw: 1,
    upper: 'spread',
    lower: 'spread',
    tongue: 'nearRidge',
    airflow: [arrow([246, 124], [208, 110]), ...outFront(100, 156)],
  }),
  pose('lateral-l', 'Tongue Lifter', {
    jaw: 2,
    upper: 'closed',
    lower: 'closed',
    tongue: 'ridge',
    contacts: [{ x: 190, y: 104 }],
    airflow: [curvedArrow([330, 186], [270, 206], [214, 190]), curvedArrow([320, 214], [262, 230], [206, 212])],
  }),
  pose('postalveolar', 'Quiet Sound', {
    jaw: 1.5,
    upper: 'rounded',
    lower: 'rounded',
    tongue: 'postRidge',
    airflow: [arrow([290, 110], [232, 96]), ...outFront(74, 150)],
  }),
  pose('postalveolar-affricate', 'Chomper', {
    jaw: 1.5,
    upper: 'rounded',
    lower: 'rounded',
    tongue: 'postRidgeTouch',
    contacts: [{ x: 226, y: 92 }],
    airflow: outFront(74, 150),
  }),
  pose('velar', 'Back Tongue Sound', { jaw: 2, upper: 'closed', lower: 'closed', tongue: 'back', contacts: [{ x: 352, y: 112 }] }),
  pose('glottal-h', 'Breathy Sound', {
    jaw: 4,
    upper: 'closed',
    lower: 'closed',
    tongue: 'lowMid',
    airflow: [arrow([396, 150], [330, 142]), arrow([290, 140], [220, 140]), ...outFront(100, 162)],
  }),
  pose('rounded-w', 'Lip Rounder', { jaw: 1.5, upper: 'rounded', lower: 'rounded', tongue: 'backHigh', airflow: [arrow([84, 150], [50, 150])] }),
  pose('rhotic-r', 'R Sound', { jaw: 2, upper: 'rounded', lower: 'rounded', tongue: 'bunched' }),
  pose('palatal-y', 'Y Sound', { jaw: 1.5, upper: 'closed', lower: 'closed', tongue: 'palatal' }),
  pose('vowel-front', 'Smile Vowel', { jaw: 2, upper: 'spread', lower: 'spread', tongue: 'frontHigh' }),
  pose('vowel-open', 'Open Mouth Vowel', { jaw: 8, upper: 'closed', lower: 'closed', tongue: 'low' }),
  pose('vowel-rounded-back', 'Round Vowel', { jaw: 3, upper: 'rounded', lower: 'rounded', tongue: 'backHigh' }),
];
