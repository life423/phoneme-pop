import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board, MAX_STROKE_NUMBERS } from './board.js';
import { BOX_COUNTS, MAX_TILES, cleanTileText } from '../../shared/tiles.js';

const FLUSH_MS = 40; // stroke points go out about 25 times a second
const THROTTLE_MS = 33; // pointers and dragged tiles about 30 times a second
const CHUNK = 128; // numbers per message
const round1 = (n) => Math.round(n * 10) / 10;
const makeId = (prefix) => `${prefix[0]}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// State that updates at most once per animation frame, for pointer-driven things.
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

// Keeps a local copy of the shared board (strokes, tiles and settings) in step with the
// server, and sends this person's strokes in small batches and their pointer and tile
// drags throttled.
export function useWhiteboard(role, send) {
  const [board] = useState(() => new Board());
  const [, setVersion] = useState(0);
  const [settings, setSettings] = useState({ strip: true, boxes: 0 });
  const [, setTileFrame] = useFrameState(0);
  const sendRef = useRef(send);
  sendRef.current = send;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const active = useRef(null);
  const flushTimer = useRef(null);
  const channels = useRef({});
  const tiles = useRef(new Map());

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const renderTiles = useCallback(() => setTileFrame(performance.now()), [setTileFrame]);

  useEffect(
    () => () => {
      clearTimeout(flushTimer.current);
      for (const channel of Object.values(channels.current)) clearTimeout(channel.timer);
    },
    [],
  );

  // Strokes
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

  // At most one message per channel every THROTTLE_MS; the newest one always wins.
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
      Math.max(0, THROTTLE_MS - (performance.now() - channel.last)),
    );
  }, []);

  const cancelThrottled = useCallback((name) => {
    const channel = channels.current[name];
    if (!channel) return;
    clearTimeout(channel.timer);
    channel.timer = null;
  }, []);

  const sendPointer = useCallback((message) => sendThrottled('p', message), [sendThrottled]);
  const sendMove = useCallback((message) => sendThrottled('move', message), [sendThrottled]);

  // Tiles. Dragging is shown here straight away; the server confirms the final spot on drop.
  const tileActions = useMemo(
    () => ({
      grab(id) {
        const tile = tiles.current.get(id);
        if (!tile) return;
        tile.heldBy = role;
        tile.z = Math.max(0, ...[...tiles.current.values()].map((t) => t.z)) + 1;
        renderTiles();
        sendRef.current({ t: 'tile:grab', id });
      },
      move(id, x, y) {
        const tile = tiles.current.get(id);
        if (!tile) return;
        tile.x = x;
        tile.y = y;
        renderTiles();
        sendThrottled('tile', { t: 'tile:move', id, x, y });
      },
      drop(id, x, y) {
        cancelThrottled('tile');
        const tile = tiles.current.get(id);
        if (tile) tile.heldBy = null;
        renderTiles();
        sendRef.current({ t: 'tile:drop', id, x, y });
      },
      remove(id) {
        sendRef.current({ t: 'tile:delete', id });
      },
    }),
    [role, renderTiles, sendThrottled, cancelThrottled],
  );

  // Tutor controls. Spaces separate tiles, so sh stays one tile and c a t makes three.
  const addTiles = useCallback((input) => {
    const tokens = String(input)
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    const good = tokens.map(cleanTileText).filter(Boolean);
    const sending = good.slice(0, Math.max(0, MAX_TILES - tiles.current.size));
    if (sending.length) sendRef.current({ t: 'tile:add', tiles: sending.map((text) => ({ id: makeId('tile'), text })) });
    return { added: sending.length, skipped: tokens.length - good.length, full: good.length > sending.length };
  }, []);

  const editTile = useCallback((id, input) => {
    const text = cleanTileText(input);
    if (!text || !tiles.current.has(id)) return false;
    sendRef.current({ t: 'tile:edit', id, text });
    return true;
  }, []);

  const resetTiles = useCallback(() => sendRef.current({ t: 'tiles:reset' }), []);
  const clearTiles = useCallback(() => sendRef.current({ t: 'tiles:clear' }), []);
  const setStrip = useCallback((on) => sendRef.current({ t: 'strip:set', on }), []);
  const setBoxes = useCallback((count) => sendRef.current({ t: 'boxes:set', count }), []);

  // After a server restart, the tutor hands back the board they still have: strokes,
  // tiles (in stacking order) and settings.
  const restore = useCallback(
    (tools) => {
      for (const s of board.strokes) sendRef.current({ t: 'rs', id: s.id, by: s.by, tool: s.tool, pts: s.pts });
      const ordered = [...tiles.current.values()].sort((a, b) => a.z - b.z);
      for (const tile of ordered) sendRef.current({ t: 'rs-tile', tile });
      const { strip, boxes } = settingsRef.current;
      sendRef.current({ t: 'restored', tools, strip, boxes });
    },
    [board],
  );

  // Messages from the server. Returns true when the message was about the board.
  const handle = useCallback(
    (msg) => {
      const putTile = (tile) => {
        if (tile && tile.id) tiles.current.set(tile.id, tile);
      };
      switch (msg.t) {
        case 'board':
          active.current = null;
          board.replace(Array.isArray(msg.strokes) ? msg.strokes : []);
          tiles.current = new Map((Array.isArray(msg.tiles) ? msg.tiles : []).map((t) => [t.id, t]));
          setSettings({ strip: msg.strip !== false, boxes: BOX_COUNTS.includes(msg.boxes) ? msg.boxes : 0 });
          renderTiles();
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
        case 'tile:add':
          for (const tile of msg.tiles || []) putTile(tile);
          renderTiles();
          return true;
        case 'tile:grab': {
          const tile = tiles.current.get(msg.id);
          if (tile) Object.assign(tile, { heldBy: msg.by, z: msg.z });
          renderTiles();
          return true;
        }
        case 'tile:move': {
          const tile = tiles.current.get(msg.id);
          if (tile) Object.assign(tile, { x: msg.x, y: msg.y });
          renderTiles();
          return true;
        }
        case 'tile:drop':
        case 'tile:edit':
        case 'tile:denied':
          putTile(msg.tile);
          renderTiles();
          return true;
        case 'tile:delete':
          tiles.current.delete(msg.id);
          renderTiles();
          return true;
        case 'tiles':
          tiles.current = new Map((msg.tiles || []).map((t) => [t.id, t]));
          renderTiles();
          return true;
        case 'strip:set':
          setSettings((s) => ({ ...s, strip: Boolean(msg.on) }));
          return true;
        case 'boxes:set':
          setSettings((s) => ({ ...s, boxes: BOX_COUNTS.includes(msg.count) ? msg.count : 0 }));
          return true;
        default:
          return false;
      }
    },
    [board, bump, renderTiles],
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
    tiles: [...tiles.current.values()],
    tileActions,
    addTiles,
    editTile,
    resetTiles,
    clearTiles,
    strip: settings.strip,
    boxes: settings.boxes,
    setStrip,
    setBoxes,
  };
}
