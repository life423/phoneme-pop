// Cartoon glove pointers. The student's is white with a purple cuff; the tutor's is
// tinted blue to match their ink. The fingertip sits exactly on (x, y).
const PALETTES = {
  student: { glove: '#ffffff', line: '#3b0764', cuff: '#7c3aed', glow: '#8b5cf6' },
  tutor: { glove: '#dbeafe', line: '#1e3a8a', cuff: '#2563eb', glow: '#3b82f6' },
};

const SMOOTH = 'motion-safe:transition-transform motion-safe:duration-75 motion-safe:ease-linear';

function HandShape({ palette, shadow = false }) {
  const glove = shadow ? '#000000' : palette.glove;
  const cuff = shadow ? '#000000' : palette.cuff;
  return (
    <g stroke={shadow ? 'none' : palette.line} strokeWidth='5' strokeLinejoin='round' strokeLinecap='round'>
      <rect x='-13' y='0' width='26' height='74' rx='13' fill={glove} />
      <rect x='-46' y='64' width='32' height='24' rx='12' fill={glove} transform='rotate(-28 -30 76)' />
      <rect x='-30' y='54' width='74' height='68' rx='24' fill={glove} />
      {!shadow && <path d='M 2 74 Q 14 69 26 74 M 2 90 Q 15 85 28 90 M 4 106 Q 15 101 26 106' fill='none' />}
      <rect x='-34' y='116' width='82' height='26' rx='10' fill={cuff} />
    </g>
  );
}

export default function Hand({ x, y, by = 'student', smooth = false, glow = false }) {
  const palette = PALETTES[by] || PALETTES.student;
  return (
    <g pointerEvents='none' className={smooth ? SMOOTH : ''} style={{ transform: `translate(${x}px, ${y}px)` }}>
      {glow && <ellipse cx='2' cy='70' rx='72' ry='90' fill={palette.glow} opacity='0.2' />}
      <g transform='translate(7 9)' opacity='0.18'>
        <HandShape palette={palette} shadow />
      </g>
      <HandShape palette={palette} />
    </g>
  );
}
