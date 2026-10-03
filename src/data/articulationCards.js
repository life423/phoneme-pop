// The 16 base articulation cards. Each card is one reusable mouth position (one pose in
// src/assets/articulation/poses.js) and lists the sounds made with it. Sounds that share a
// mouth position share a card; voicing and nasality are noted per sound instead.
// To add a card: add a pose, add a card here, and map its sounds below.

export const ARTICULATION_CARDS = [
  { id: 'bilabial-closed', title: 'Lip Popper', name: 'Bilabial', sounds: ['p', 'b', 'm'], instruction: 'Press your lips together, then pop them open.' },
  { id: 'labiodental', title: 'Lip Biter', name: 'Labiodental', sounds: ['f', 'v'], instruction: 'Bottom lip touches upper teeth.' },
  { id: 'interdental', title: 'Tongue Peeker', name: 'Interdental', sounds: ['th', 'dh'], instruction: 'Tongue peeks out between your teeth.' },
  { id: 'alveolar-stop', title: 'Tongue Tapper', name: 'Alveolar stop', sounds: ['t', 'd', 'n'], instruction: 'Tongue tip taps the bump behind your top teeth.' },
  { id: 'alveolar-fricative', title: 'Snake Sound', name: 'Alveolar fricative', sounds: ['s', 'z'], instruction: 'Teeth close together. Hiss the air over your tongue.' },
  { id: 'lateral-l', title: 'Tongue Lifter', name: 'Lateral', sounds: ['l'], instruction: 'Lift your tongue tip to the bump behind your top teeth.' },
  { id: 'postalveolar', title: 'Quiet Sound', name: 'Postalveolar fricative', sounds: ['sh', 'zh'], instruction: 'Round your lips and push the quiet air out.' },
  { id: 'postalveolar-affricate', title: 'Chomper', name: 'Postalveolar affricate', sounds: ['ch', 'j'], instruction: 'Press your tongue up, then let the air burst out.' },
  { id: 'velar', title: 'Back Tongue Sound', name: 'Velar', sounds: ['k', 'g', 'ng'], instruction: 'Lift the back of your tongue to the roof of your mouth.' },
  { id: 'glottal-h', title: 'Breathy Sound', name: 'Glottal', sounds: ['h'], instruction: 'Open your mouth and breathe the air out.' },
  { id: 'rounded-w', title: 'Lip Rounder', name: 'Rounded back glide', sounds: ['w'], instruction: 'Round your lips into a small circle.' },
  { id: 'rhotic-r', title: 'R Sound', name: 'Rhotic', sounds: ['r'], instruction: 'Pull your tongue back without touching the roof of your mouth.' },
  { id: 'palatal-y', title: 'Y Sound', name: 'Palatal glide', sounds: ['y'], instruction: 'Lift the middle of your tongue toward the roof of your mouth.' },
  { id: 'vowel-front', title: 'Smile Vowel', name: 'Front vowel', sounds: ['ee', 'i', 'e'], instruction: 'Smile and keep your tongue high and forward.' },
  { id: 'vowel-open', title: 'Open Mouth Vowel', name: 'Open vowel', sounds: ['a', 'ah'], instruction: 'Drop your jaw and open your mouth wide.' },
  { id: 'vowel-rounded-back', title: 'Round Vowel', name: 'Rounded back vowel', sounds: ['o', 'oo'], instruction: 'Round your lips and pull your tongue back.' },
];

// How each sound is written on a card. Two sounds share the spelling th, so they say which.
export const SOUND_LABELS = { th: '/th/ as in think', dh: '/th/ as in this', j: '/j/ as in jump', y: '/y/ as in yes', a: '/a/ as in cat' };
export const soundLabel = (sound) => SOUND_LABELS[sound] || `/${sound}/`;

// The line at the bottom of a card: Makes the /f/ and /v/ sounds.
export function cardSoundLine(card) {
  const labels = card.sounds.map(soundLabel);
  const list = labels.length < 3 ? labels.join(' and ') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return `Makes the ${list} sound${labels.length > 1 ? 's' : ''}.`;
}

// Every sound: its card, whether the voice is on, whether air goes through the nose, and how to say it.
const sound = (card, voiced, instruction, extra = {}) => ({ card, voiced, instruction, ...extra });
export const articulationPoses = {
  p: sound('bilabial-closed', false, 'Press your lips together, then release the air.'),
  b: sound('bilabial-closed', true, 'Press your lips together and turn your voice on.'),
  m: sound('bilabial-closed', true, 'Close your lips and let the sound come through your nose.', { nasal: true }),
  f: sound('labiodental', false, 'Gently touch your bottom lip to your upper teeth and blow air.'),
  v: sound('labiodental', true, 'Touch your bottom lip to your upper teeth and turn your voice on.'),
  th: sound('interdental', false, 'Put your tongue between your teeth and blow air, as in think.'),
  dh: sound('interdental', true, 'Put your tongue between your teeth and turn your voice on, as in this.'),
  t: sound('alveolar-stop', false, 'Tap your tongue tip behind your top teeth and let the air pop.'),
  d: sound('alveolar-stop', true, 'Tap your tongue tip behind your top teeth with your voice on.'),
  n: sound('alveolar-stop', true, 'Hold your tongue tip behind your top teeth and hum through your nose.', { nasal: true }),
  s: sound('alveolar-fricative', false, 'Keep your teeth close and hiss like a snake.'),
  z: sound('alveolar-fricative', true, 'Keep your teeth close and buzz like a bee.'),
  l: sound('lateral-l', true, 'Lift your tongue tip behind your top teeth and let the sound flow around it.'),
  sh: sound('postalveolar', false, 'Round your lips and push the air out quietly, like shh.'),
  zh: sound('postalveolar', true, 'Round your lips and turn your voice on, as in treasure.'),
  ch: sound('postalveolar-affricate', false, 'Press your tongue up, then let the air burst out, like a sneeze: ch.'),
  j: sound('postalveolar-affricate', true, 'Press your tongue up and burst it out with your voice on, as in jump.'),
  k: sound('velar', false, 'Lift the back of your tongue and let the air pop.'),
  g: sound('velar', true, 'Lift the back of your tongue and pop it with your voice on.'),
  ng: sound('velar', true, 'Lift the back of your tongue and hum through your nose, as in sing.', { nasal: true }),
  h: sound('glottal-h', false, 'Open your mouth and breathe out, like fogging a window.'),
  w: sound('rounded-w', true, 'Round your lips into a small circle, then open them.'),
  r: sound('rhotic-r', true, 'Pull your tongue back without touching the roof of your mouth.'),
  y: sound('palatal-y', true, 'Lift the middle of your tongue toward the roof of your mouth.'),
  ee: sound('vowel-front', true, 'Smile wide with your tongue high and forward, as in see.'),
  i: sound('vowel-front', true, 'Smile a little with your tongue high, as in sit.'),
  e: sound('vowel-front', true, 'Open a little more with your tongue forward, as in bed.'),
  a: sound('vowel-open', true, 'Drop your jaw and open wide, as in cat.'),
  ah: sound('vowel-open', true, 'Drop your jaw and say ah, like at the doctor.'),
  o: sound('vowel-rounded-back', true, 'Round your lips and drop your jaw a little, as in hot.'),
  oo: sound('vowel-rounded-back', true, 'Round your lips into a small circle, as in moon.'),
};
