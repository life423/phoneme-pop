import { memo, useEffect, useRef } from 'react';
import { drawAll, drawStroke } from './board.js';
import { STAGE } from './stage.js';

// One ink layer: a canvas laid exactly over the stage, in stage coordinates, clipped
// to the board (`clip`), drawing the strokes that `include` picks. New points draw
// straight away; anything that changes the order (a stroke ending, undo, clear)
// replays the whole list.
function InkCanvas({ board, layout, include, clip }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layout.width) return undefined;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(layout.width * dpr);
    canvas.height = Math.round(layout.height * dpr);
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / STAGE.width;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(clip.x, clip.y, clip.width, clip.height, 20);
    else ctx.rect(clip.x, clip.y, clip.width, clip.height);
    ctx.clip();

    let frame = 0;
    const redraw = () => {
      frame = 0;
      drawAll(ctx, board.strokes.filter(include));
    };
    redraw();
    const unsubscribe = board.subscribe((event) => {
      if (frame) return; // a full redraw is already on its way
      if (event.type !== 'segment') frame = requestAnimationFrame(redraw);
      else if (include(event.stroke)) drawStroke(ctx, event.stroke, event.from);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [board, include, clip, layout.width, layout.height]);

  return (
    <canvas
      ref={ref}
      aria-hidden='true'
      className='pointer-events-none absolute'
      style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
    />
  );
}

export default memo(InkCanvas);
