// A cartoon glove pointer. Its fingertip sits exactly on (x, y) in stage coordinates.
function HandShape({ shadow = false }) {
  const glove = shadow ? '#000000' : '#ffffff';
  const cuff = shadow ? '#000000' : '#7c3aed';
  return (
    <g stroke={shadow ? 'none' : '#3b0764'} strokeWidth='5' strokeLinejoin='round' strokeLinecap='round'>
      <rect x='-13' y='0' width='26' height='74' rx='13' fill={glove} />
      <rect x='-46' y='64' width='32' height='24' rx='12' fill={glove} transform='rotate(-28 -30 76)' />
      <rect x='-30' y='54' width='74' height='68' rx='24' fill={glove} />
      {!shadow && <path d='M 2 74 Q 14 69 26 74 M 2 90 Q 15 85 28 90 M 4 106 Q 15 101 26 106' fill='none' />}
      <rect x='-34' y='116' width='82' height='26' rx='10' fill={cuff} />
    </g>
  );
}

export default function Hand({ x, y, smooth = false }) {
  return (
    <g
      pointerEvents='none'
      className={smooth ? 'motion-safe:transition-transform motion-safe:duration-75 motion-safe:ease-linear' : ''}
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <g transform='translate(7 9)' opacity='0.18'>
        <HandShape shadow />
      </g>
      <HandShape />
    </g>
  );
}
