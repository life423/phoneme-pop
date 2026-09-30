// One picture piece on the board: a window onto its picture, rounded like the original.
// Nothing is cropped or copied; the browser just shows that part of the picture.
export default function PieceImage({ piece, pic, src }) {
  if (!pic) return null;
  const { crop } = piece;
  const clip = `piece-clip-${piece.id}`;
  return (
    <svg
      x={piece.x}
      y={piece.y}
      width={piece.w}
      height={piece.h}
      viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
      preserveAspectRatio='none'
    >
      <defs>
        <clipPath id={clip}>
          <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} rx={crop.r} />
        </clipPath>
      </defs>
      <image href={src} width={pic.w} height={pic.h} clipPath={`url(#${clip})`} preserveAspectRatio='none' />
    </svg>
  );
}
