import { useCallback, useEffect, useRef, useState } from 'react';
import { Board, MAX_STROKE_NUMBERS } from './board.js';

const FLUSH_MS = 40; // stroke points go out about 25 times a second
const POINTER_MS = 33; // pointers about 30 times a second
const CHUNK = 128; // numbers per message
const round1 = (n) => Math.round(n * 10) / 10;
const makeId = (role) => `${role[0]}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// State that updates at most once per animation frame, for pointer-driven markers.
export function useFrameState(initial) {
  const [value, setValue] = useState(initial);
  const next = useRef(initial);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const set = useCallback((v) => {
    next.current = v;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setValue(next.current);
    });
  }, []);
  return [value, set];
}

// Keeps a local copy of the shared board in step with the server, and sends
// this person's strokes (in small batches) and pointer (throttled).
export function useWhiteboard(role, send) {
  const [board] = useState(() => new Board());
  const [, setVersion] = useState(0);
  const sendRef = useRef(send);
  sendRef.current = send;
  const active = useRef(null);
  const flushTimer = useRef(null);
  const channels = useRef({}); // throttled senders: 'p' (my pointer), 'move' (the student's hand)

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(
    () => () => {
      clearTimeout(flushTimer.current);
      for (const channel of Object.values(channels.current)) clearTimeout(channel.timer);
    },
    [],
  );

  const flush = useCallback(() => {
    clearTimeout(flushTimer.current);
    flushTimer.current = null;
    const current = active.current;
    if (!current || !current.pending.length) return;
    for (let i = 0; i < current.pending.length; i += CHUNK) {
      sendRef.current({ t: 'm', id: current.id, pts: current.pending.slice(i, i + CHUNK) });
    }
    current.pending = [];
  }, []);

  const end = useCallback(() => {
    const current = active.current;
    if (!current) return;
    flush();
    active.current = null;
    board.finish(current.id);
    sendRef.current({ t: 'e', id: current.id });
  }, [board, flush]);

  const start = useCallback(
    (tool, { x, y }) => {
      if (active.current) end();
      const id = makeId(role);
      const pts = [round1(x), round1(y)];
      active.current = { id, pending: [], lastX: pts[0], lastY: pts[1], size: 2 };
      board.add({ id, by: role, tool, pts });
      sendRef.current({ t: 's', id, tool, x: pts[0], y: pts[1] });
      bump();
    },
    [board, bump, end, role],
  );

  const move = useCallback(
    (points) => {
      const current = active.current;
      if (!current) return;
      const fresh = [];
      for (const { x, y } of points) {
        const rx = round1(x);
        const ry = round1(y);
        if (Math.abs(rx - current.lastX) + Math.abs(ry - current.lastY) < 1) continue;
        current.lastX = rx;
        current.lastY = ry;
        fresh.push(rx, ry);
      }
      if (!fresh.length) return;
      if (current.size + fresh.length > MAX_STROKE_NUMBERS) {
        end();
        return;
      }
      current.size += fresh.length;
      board.append(current.id, fresh);
      current.pending.push(...fresh);
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, FLUSH_MS);
    },
    [board, end, flush],
  );

  const undo = useCallback(() => sendRef.current({ t: 'undo' }), []);

  // At most one message per channel every POINTER_MS; the newest one always wins.
  const sendThrottled = useCallback((name, message) => {
    const channel = channels.current[name] || (channels.current[name] = { timer: null, last: 0, message: null });
    channel.message = message;
    if (channel.timer) return;
    channel.timer = setTimeout(
      () => {
        channel.timer = null;
        channel.last = performance.now();
        sendRef.current(channel.message);
      },
      Math.max(0, POINTER_MS - (performance.now() - channel.last)),
    );
  }, []);
  const sendPointer = useCallback((message) => sendThrottled('p', message), [sendThrottled]);
  const sendMove = useCallback((message) => sendThrottled('move', message), [sendThrottled]);

  // After a server restart, the tutor hands back the board they still have.
  const restore = useCallback(
    (tools) => {
      if (!board.strokes.length) {
        if (tools) sendRef.current({ t: 'tools', on: true });
        return;
      }
      for (const s of board.strokes) sendRef.current({ t: 'rs', id: s.id, by: s.by, tool: s.tool, pts: s.pts });
      sendRef.current({ t: 'restored', tools });
    },
    [board],
  );

  // Board messages from the server. Returns true when the message was one of them.
  const handle = useCallback(
    (msg) => {
      switch (msg.t) {
        case 'board':
          active.current = null;
          board.replace(Array.isArray(msg.strokes) ? msg.strokes : []);
          bump();
          return true;
        case 's':
          board.add({ id: msg.id, by: msg.by, tool: msg.tool, pts: [msg.x, msg.y], seq: msg.seq });
          return true;
        case 'm':
          board.append(msg.id, msg.pts);
          return true;
        case 'e':
          board.finish(msg.id);
          return true;
        case 'ack':
          board.setSeq(msg.id, msg.seq);
          return true;
        case 'undo':
          if (active.current?.id === msg.id) active.current = null;
          board.remove(msg.id);
          bump();
          return true;
        default:
          return false;
      }
    },
    [board, bump],
  );

  return {
    board,
    handle,
    stroke: { start, move, end },
    undo,
    canUndo: board.lastBy(role) !== null,
    sendPointer,
    sendMove,
    restore,
  };
}
