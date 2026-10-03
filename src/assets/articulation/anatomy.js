// The invariant anatomy shared by every articulation pose: one set of paths, defined once.
// A close-up side view of the mouth facing left, cut away to show the tongue and palate, in
// the style of the Lip Biter card drawing. 400 x 400, transparent background.
// Poses never redraw any of this. They supply only the tongue, the lips, a jaw opening (a
// rotation of the shared jaw paths about JAW_HINGE), contact markers and airflow.

export const VIEW_BOX = '0 0 400 400';

export const COLORS = {
  skin: '#F6C7A5',
  tongue: '#F48B8B',
  tongueHighlight: '#FFAAA5',
  teeth: '#FFFFFF',
  interior: '#293241',
  outline: '#18202B',
  airflow: '#5BA8FF',
  contact: '#8B5CF6',
};

export const STROKE = { outline: 5, detail: 3.5, airflow: 5 };

// The jaw opens by rotating about this point, far back by the ear (off the picture).
export const JAW_HINGE = { x: 560, y: 110 };

// How the drawing sits in the picture: the mouth centred and slightly enlarged. Shared by
// every pose, so they all line up exactly.
export const FRAMING = 'translate(-36 46) scale(1.12)';

// Skin of the face above the mouth and of the cheek behind it.
export const SKIN =
  'M 133 -70 L 132 -10 C 130 22 136 52 128 72 C 122 84 116 90 112 96 L 150 150 L 176 250 L 160 330 L 150 460 L 410 460 L 410 -70 Z';

// The face profile from under the nose to the top of the upper lip.
export const PROFILE = 'M 133 -70 L 132 -10 C 130 22 136 52 128 72 C 122 84 116 90 112 96';

// The inside of the mouth: under the gum and palate, back to the throat. Its bottom is hidden
// by the tongue and jaw.
export const MOUTH =
  'M 150 118 C 156 110 164 106 174 106 C 184 106 190 102 198 96 C 232 80 292 78 342 88 ' +
  'C 364 93 378 102 388 114 L 410 118 L 410 270 L 150 270 C 138 230 138 170 150 118 Z';

// The soft palate, hanging down at the back.
export const SOFT_PALATE =
  'M 336 87 C 360 92 378 104 388 122 C 395 136 397 154 393 168 C 389 176 381 174 379 165 ' +
  'C 376 150 369 132 355 118 C 348 110 342 106 334 103 Z';

// The upper front tooth.
export const UPPER_TOOTH = 'M 140 98 C 137 114 137 134 141 150 C 147 155 156 155 162 150 C 164 134 164 114 168 100 Z';

// The lower jaw: the skin of the chin and floor of the mouth (it hides the bottom of the
// tongue), the floor line under the tongue, the chin profile, and the lower front tooth.
export const JAW_FILL =
  'M 114 196 C 124 206 132 216 130 228 C 126 246 108 260 106 282 C 104 312 118 362 136 410 L 142 460 L 410 460 L 410 252 ' +
  'C 330 256 262 252 214 240 C 196 234 184 224 176 212 L 158 200 Z';
export const FLOOR = 'M 176 212 C 184 224 196 234 214 240 C 262 252 330 256 410 252';
export const CHIN = 'M 114 196 C 124 206 132 216 130 228 C 126 246 108 260 106 282 C 104 312 118 362 136 410 L 142 460';
export const LOWER_TOOTH = 'M 154 214 C 152 196 152 176 156 158 C 162 155 169 155 175 158 C 177 176 177 196 175 216 Z';

// Every shared path, so tests can check each pose contains exactly these.
export const SHARED_PATHS = { SKIN, PROFILE, MOUTH, SOFT_PALATE, UPPER_TOOTH, JAW_FILL, FLOOR, CHIN, LOWER_TOOTH };
