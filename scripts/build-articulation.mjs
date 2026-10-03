// Writes the 16 articulation SVGs into src/assets/articulation/ from the shared anatomy and
// the poses. Run after changing anatomy.js or poses.js: npm run articulation
import { writeFileSync } from 'node:fs';
import { POSES } from '../src/assets/articulation/poses.js';
import { articulationSvg } from '../src/assets/articulation/svg.js';

for (const pose of POSES) {
  writeFileSync(new URL(`../src/assets/articulation/${pose.id}.svg`, import.meta.url), articulationSvg(pose));
}
console.log(`Wrote ${POSES.length} articulation SVGs.`);
