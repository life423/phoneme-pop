import * as A from './anatomy.js';

// Builds one articulation SVG: the shared anatomy (always the same paths, in the same order)
// plus the parts a pose supplies. The jaw paths are rotated, never redrawn.
const shape = (d, fill, width = A.STROKE.outline) =>
  `<path d='${d}' fill='${fill}' stroke='${A.COLORS.outline}' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'/>`;
const line = (d, color = A.COLORS.outline, width = A.STROKE.outline) =>
  `<path d='${d}' fill='none' stroke='${color}' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'/>`;

export function articulationSvg(pose) {
  const jaw = pose.jaw ? ` transform='rotate(${-pose.jaw} ${A.JAW_HINGE.x} ${A.JAW_HINGE.y})'` : '';
  return [
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${A.VIEW_BOX}' width='400' height='400' role='img' aria-label='${pose.title}: side view of the mouth'>`,
    `<g transform='${A.FRAMING}'>`,
    `<path d='${A.SKIN}' fill='${A.COLORS.skin}'/>`,
    shape(A.MOUTH, A.COLORS.interior, A.STROKE.detail),
    shape(A.SOFT_PALATE, A.COLORS.skin, A.STROKE.detail),
    `<g id='tongue'>`,
    shape(pose.tongue, A.COLORS.tongue),
    line(pose.tongueHighlight, A.COLORS.tongueHighlight, 6),
    `</g>`,
    `<g id='jaw'${jaw}>`,
    `<path d='${A.JAW_FILL}' fill='${A.COLORS.skin}'/>`,
    line(A.FLOOR, A.COLORS.outline, A.STROKE.detail),
    line(A.CHIN),
    shape(A.LOWER_TOOTH, A.COLORS.teeth, A.STROKE.detail),
    shape(pose.lowerLip, A.COLORS.tongue),
    `</g>`,
    shape(A.UPPER_TOOTH, A.COLORS.teeth, A.STROKE.detail),
    shape(pose.upperLip, A.COLORS.tongue),
    line(A.PROFILE),
    ...(pose.contacts || []).map(
      ({ x, y, r = 9 }) =>
        `<circle cx='${x}' cy='${y}' r='${r}' fill='${A.COLORS.contact}' fill-opacity='0.35' stroke='${A.COLORS.contact}' stroke-width='3'/>`,
    ),
    ...(pose.airflow || []).map((d) => line(d, A.COLORS.airflow, A.STROKE.airflow)),
    `</g>`,
    `</svg>`,
    '',
  ].join(String.fromCharCode(10));
}
