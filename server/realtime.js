import { WebSocketServer } from 'ws';
import { randomBytes, randomInt } from 'node:crypto';
import { BOX_COUNTS, MAX_TILES, clampTile, cleanTileText, nextHome, snapTile, tileKind } from '../shared/tiles.js';

// Live rooms for the Alphabet Whiteboard: one tutor and one student per room.
// Pointers go both ways. The board is an ordered list of strokes (pen ink or
// eraser paths) that the server keeps and both screens replay. Rooms live in
// memory, so the app has to run as a single replica.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STAGE = { width: 1600, height: 1000 };
const REPLACED = 4000; // close code: the same person connected again somewhere else
const MODES = new Set(['hand', 'pen', 'eraser', 'none']);
const TOOLS = new Set(['pen', 'eraser']);
const MAX_STROKES = 2000;
const MAX_STROKE_NUMBERS = 8000; // 4,000 points
const MAX_CHUNK_NUMBERS = 256;
const POINTER_PER_SECOND = 60;
const DRAW_PER_SECOND = 120;

const isCode = (value) =>
  typeof value === 'string' && value.length === 4 && [...value].every((c) => c >= '0' && c <= '9');
const isKey = (value) => typeof value === 'string' && value.length === 32;
const isStrokeId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 40 &&
  [...value].every((c) => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-');
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const cleanLetter = (l) => (typeof l === 'string' && l.length === 1 && LETTERS.includes(l) ? l : null);
const clampTo = (n, max) => Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;

// Validates a flat [x, y, x, y, ...] list of stage coordinates and clamps it to the stage.
function cleanPoints(pts) {
  if (!Array.isArray(pts) || pts.length === 0 || pts.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < pts.length; i += 2) {
    if (!Number.isFinite(pts[i]) || !Number.isFinite(pts[i + 1])) return null;
    out.push(clampTo(pts[i], STAGE.width), clampTo(pts[i + 1], STAGE.height));
  }
  return out;
}

// Azure's ingress appends the real client address as the last X-Forwarded-For entry.
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',').pop().trim();
  return req.socket.remoteAddress || 'unknown';
}

export function attachRealtime(server, options = {}) {
  const {
    allowedOrigins = new Set(),
    tutorGraceMs = 60_000,
    maxRooms = 500,
    maxRoomsPerIp = 10,
    joinAttemptsPerWindow = 30,
    joinWindowMs = 5 * 60_000,
    heartbeatMs = 25_000,
  } = options;

  const rooms = new Map();
  const joinAttempts = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const send = (ws, msg) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const roleOf = (ws) => {
    const room = ws.room;
    if (!room) return null;
    if (room.tutor === ws) return 'tutor';
    if (room.student === ws) return 'student';
    return null;
  };
  const otherSide = (room, role) => (role === 'tutor' ? room.student : room.tutor);
  const canDraw = (room, role) => role === 'tutor' || (role === 'student' && room.tools);

  // A per-second budget for each kind of message on a socket.
  const allow = (ws, kind, perSecond) => {
    const now = Date.now();
    const bucket = ws.budget[kind] || (ws.budget[kind] = { start: now, count: 0 });
    if (now - bucket.start >= 1000) {
      bucket.start = now;
      bucket.count = 0;
    }
    bucket.count += 1;
    return bucket.count <= perSecond;
  };

  const boardMessage = (room) => ({
    t: 'board',
    tools: room.tools,
    strip: room.strip,
    boxes: room.boxes,
    strokes: room.strokes.map(({ id, by, tool, pts, seq }) => ({ id, by, tool, pts, seq })),
    tiles: [...room.tiles.values()],
  });

  const broadcast = (room, msg) => {
    send(room.tutor, msg);
    send(room.student, msg);
  };

  const isTutor = (ws) => Boolean(ws.room && ws.room.tutor === ws);

  const broadcastBoard = (room) => {
    const msg = boardMessage(room);
    send(room.tutor, msg);
    send(room.student, msg);
  };

  const sendPresence = (room) => {
    const msg = { t: 'presence', tutor: Boolean(room.tutor), student: Boolean(room.student) };
    send(room.tutor, msg);
    send(room.student, msg);
  };

  // Ends whatever stroke this socket was drawing and tells the other person.
  const finishStroke = (ws, room) => {
    const stroke = ws.openStroke && room.strokeById.get(ws.openStroke);
    ws.openStroke = null;
    if (!stroke || stroke.done) return;
    stroke.done = true;
    send(otherSide(room, stroke.by), { t: 'e', id: stroke.id });
  };

  // Lets go of any tile this socket was dragging.
  const releaseTiles = (ws, room) => {
    const role = room.tutor === ws ? 'tutor' : room.student === ws ? 'student' : null;
    if (!role) return;
    for (const tile of room.tiles.values()) {
      if (tile.heldBy !== role) continue;
      tile.heldBy = null;
      send(otherSide(room, role), { t: 'tile:drop', tile });
    }
  };

  const closeRoom = (room, reason) => {
    clearTimeout(room.closeTimer);
    if (rooms.get(room.code) === room) rooms.delete(room.code);
    for (const ws of [room.tutor, room.student]) {
      if (!ws) continue;
      ws.room = null;
      ws.openStroke = null;
      send(ws, { t: 'closed', reason });
    }
  };

  const leaveRoom = (ws) => {
    const room = ws.room;
    if (!room) return;
    finishStroke(ws, room);
    releaseTiles(ws, room);
    ws.room = null;
    if (room.tutor === ws) {
      room.tutor = null;
      delete room.pointers.tutor;
      clearTimeout(room.closeTimer);
      room.closeTimer = setTimeout(() => closeRoom(room, 'tutor-left'), tutorGraceMs);
    } else if (room.student === ws) {
      room.student = null;
      delete room.pointers.student;
    }
    sendPresence(room);
  };

  const replace = (room, oldWs, newWs) => {
    if (!oldWs || oldWs === newWs) return;
    finishStroke(oldWs, room);
    oldWs.room = null;
    oldWs.close(REPLACED, 'replaced');
  };

  const newCode = () => {
    for (let i = 0; i < 100; i += 1) {
      const code = String(randomInt(1000, 10000));
      if (!rooms.has(code)) return code;
    }
    return null;
  };

  const allowJoin = (ip) => {
    const now = Date.now();
    const recent = (joinAttempts.get(ip) || []).filter((t) => now - t < joinWindowMs);
    recent.push(now);
    joinAttempts.set(ip, recent);
    return recent.length <= joinAttemptsPerWindow;
  };

  const handlers = {
    // A tutor opens a room, or takes theirs back after a reconnect or a server restart.
    create(ws, msg) {
      let room = isCode(msg.code) ? rooms.get(msg.code) : undefined;
      if (room && room.key !== msg.key) room = undefined;
      let fresh = false;
      if (!room) {
        const reuse = isCode(msg.code) && isKey(msg.key) && !rooms.has(msg.code);
        const code = reuse ? msg.code : newCode();
        let owned = 0;
        for (const r of rooms.values()) if (r.ip === ws.ip) owned += 1;
        if (!code || rooms.size >= maxRooms || owned >= maxRoomsPerIp) return send(ws, { t: 'error', reason: 'busy' });
        room = {
          code,
          key: reuse ? msg.key : randomBytes(16).toString('hex'),
          ip: ws.ip,
          tutor: null,
          student: null,
          studentKey: null,
          closeTimer: null,
          tools: false,
          strokes: [],
          strokeById: new Map(),
          seq: 0,
          pointers: {}, // last known pointer of each person, for whoever (re)joins
          tiles: new Map(),
          zTop: 0, // stacking order: the tile picked up last sits on top
          order: 0, // creation order, for packing the tray
          strip: true,
          boxes: 0,
          // After a restart the tutor's browser hands back its copy of the board.
          restoring: reuse,
        };
        rooms.set(code, room);
        fresh = true;
      }
      if (ws.room !== room) leaveRoom(ws);
      clearTimeout(room.closeTimer);
      replace(room, room.tutor, ws);
      room.tutor = ws;
      ws.room = room;
      send(ws, { t: 'room', role: 'tutor', code: room.code, key: room.key, fresh });
      sendPresence(room);
      if (!fresh) send(ws, boardMessage(room));
      if (room.pointers.student) send(ws, { t: 'p', ...room.pointers.student });
    },

    // A student joins with their tutor's code. Their key lets them take back
    // their own seat after a dropped connection.
    join(ws, msg) {
      if (!allowJoin(ws.ip)) return send(ws, { t: 'error', reason: 'slow-down' });
      const room = isCode(msg.code) ? rooms.get(msg.code) : undefined;
      if (!room) return send(ws, { t: 'error', reason: 'no-room' });
      const returning = isKey(msg.key) && msg.key === room.studentKey;
      if (room.student && room.student !== ws && !returning) return send(ws, { t: 'error', reason: 'room-full' });
      if (ws.room !== room) leaveRoom(ws);
      replace(room, room.student, ws);
      room.student = ws;
      room.studentKey = returning ? msg.key : randomBytes(16).toString('hex');
      ws.room = room;
      send(ws, { t: 'room', role: 'student', code: room.code, key: room.studentKey });
      sendPresence(room);
      send(ws, boardMessage(room));
      if (room.pointers.tutor) send(ws, { t: 'p', ...room.pointers.tutor });
      if (returning && room.pointers.student) {
        const { x, y, l } = room.pointers.student;
        send(ws, { t: 'moved', x, y, l });
      }
    },

    // Pointers go to the other person: 0-1 stage coordinates, the tool in hand,
    // and for the pointing hand, the letter under the fingertip.
    p(ws, msg) {
      const role = roleOf(ws);
      if (!role || !allow(ws, 'pointer', POINTER_PER_SECOND)) return;
      const room = ws.room;
      const to = otherSide(room, role);
      const mode = MODES.has(msg.m) ? msg.m : 'hand';
      if (mode === 'none') {
        delete room.pointers[role];
        return send(to, { t: 'p', m: 'none' });
      }
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
      const pointer = { x: clamp01(msg.x), y: clamp01(msg.y), l: mode === 'hand' ? cleanLetter(msg.l) : null, m: mode };
      room.pointers[role] = pointer;
      send(to, { t: 'p', ...pointer });
    },

    // Tutor only: guide the student's hand. There is no way to move the tutor's.
    move(ws, msg) {
      const room = ws.room;
      if (!room || room.tutor !== ws || !allow(ws, 'move', POINTER_PER_SECOND)) return;
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
      const pointer = { x: clamp01(msg.x), y: clamp01(msg.y), l: cleanLetter(msg.l), m: 'hand' };
      room.pointers.student = pointer;
      send(room.student, { t: 'moved', x: pointer.x, y: pointer.y, l: pointer.l });
    },

    // Stroke start. The student may only draw while the tutor has their tools on.
    s(ws, msg) {
      const role = roleOf(ws);
      if (!role || !canDraw(ws.room, role) || !allow(ws, 'draw', DRAW_PER_SECOND)) return;
      const room = ws.room;
      if (!isStrokeId(msg.id) || room.strokeById.has(msg.id) || !TOOLS.has(msg.tool)) return;
      if (room.strokes.length >= MAX_STROKES) return send(ws, { t: 'error', reason: 'board-full' });
      const start = cleanPoints([msg.x, msg.y]);
      if (!start) return;
      finishStroke(ws, room);
      room.restoring = false;
      room.seq += 1;
      const stroke = { id: msg.id, by: role, tool: msg.tool, pts: start, seq: room.seq, done: false };
      room.strokes.push(stroke);
      room.strokeById.set(stroke.id, stroke);
      ws.openStroke = stroke.id;
      send(ws, { t: 'ack', id: stroke.id, seq: stroke.seq });
      send(otherSide(room, role), { t: 's', id: stroke.id, by: role, tool: stroke.tool, x: start[0], y: start[1], seq: stroke.seq });
    },

    // More points for the stroke this socket is drawing.
    m(ws, msg) {
      const role = roleOf(ws);
      if (!role || !allow(ws, 'draw', DRAW_PER_SECOND)) return;
      const room = ws.room;
      const stroke = room.strokeById.get(msg.id);
      if (!stroke || stroke.done || ws.openStroke !== stroke.id) return;
      if (!Array.isArray(msg.pts) || msg.pts.length > MAX_CHUNK_NUMBERS) return;
      const pts = cleanPoints(msg.pts);
      if (!pts || stroke.pts.length + pts.length > MAX_STROKE_NUMBERS) return;
      for (const n of pts) stroke.pts.push(n);
      send(otherSide(room, role), { t: 'm', id: stroke.id, pts });
    },

    e(ws, msg) {
      if (ws.room && isStrokeId(msg.id) && ws.openStroke === msg.id) finishStroke(ws, ws.room);
    },

    // Takes back the sender's own most recent stroke, never the other person's.
    undo(ws) {
      const role = roleOf(ws);
      if (!role || !canDraw(ws.room, role) || !allow(ws, 'draw', DRAW_PER_SECOND)) return;
      const room = ws.room;
      for (let i = room.strokes.length - 1; i >= 0; i -= 1) {
        const stroke = room.strokes[i];
        if (stroke.by !== role) continue;
        room.strokes.splice(i, 1);
        room.strokeById.delete(stroke.id);
        if (ws.openStroke === stroke.id) ws.openStroke = null;
        send(room.tutor, { t: 'undo', id: stroke.id });
        send(room.student, { t: 'undo', id: stroke.id });
        return;
      }
    },

    // Tutor only: wipe the board for both.
    clear(ws) {
      const room = ws.room;
      if (!room || room.tutor !== ws) return;
      room.strokes = [];
      room.strokeById.clear();
      for (const w of [room.tutor, room.student]) if (w) w.openStroke = null;
      broadcastBoard(room);
    },

    // Tutor only: turn the student's toolbar on or off.
    tools(ws, msg) {
      const room = ws.room;
      if (!room || room.tutor !== ws) return;
      room.tools = Boolean(msg.on);
      if (!room.tools && room.student) finishStroke(room.student, room);
      send(room.tutor, { t: 'tools', on: room.tools });
      send(room.student, { t: 'tools', on: room.tools });
    },

    // Tutor only, right after a restart: one stroke of the board they kept.
    rs(ws, msg) {
      const room = ws.room;
      if (!room || room.tutor !== ws || !room.restoring || room.strokes.length >= MAX_STROKES) return;
      if (!isStrokeId(msg.id) || room.strokeById.has(msg.id) || !TOOLS.has(msg.tool)) return;
      if (msg.by !== 'tutor' && msg.by !== 'student') return;
      if (!Array.isArray(msg.pts) || msg.pts.length > MAX_STROKE_NUMBERS) return;
      const pts = cleanPoints(msg.pts);
      if (!pts) return;
      room.seq += 1;
      const stroke = { id: msg.id, by: msg.by, tool: msg.tool, pts, seq: room.seq, done: true };
      room.strokes.push(stroke);
      room.strokeById.set(stroke.id, stroke);
    },

    // Tutor only: the restore is complete, so everyone gets the board.
    restored(ws, msg) {
      const room = ws.room;
      if (!room || room.tutor !== ws || !room.restoring) return;
      room.restoring = false;
      room.tools = Boolean(msg.tools);
      room.strip = msg.strip !== false;
      room.boxes = BOX_COUNTS.includes(msg.boxes) ? msg.boxes : 0;
      broadcastBoard(room);
    },

    // Tutor only: new tiles line up on the tray, in the order typed.
    'tile:add'(ws, msg) {
      const room = ws.room;
      if (!isTutor(ws) || !Array.isArray(msg.tiles)) return;
      const added = [];
      for (const item of msg.tiles.slice(0, MAX_TILES)) {
        const text = cleanTileText(item && item.text);
        if (room.tiles.size >= MAX_TILES || !text || !isStrokeId(item.id) || room.tiles.has(item.id)) continue;
        const home = nextHome([...room.tiles.values()], text);
        room.zTop += 1;
        room.order += 1;
        const tile = { id: item.id, text, kind: tileKind(text), x: home.hx, y: home.hy, ...home, z: room.zTop, order: room.order, heldBy: null };
        room.tiles.set(tile.id, tile);
        added.push(tile);
      }
      if (added.length) broadcast(room, { t: 'tile:add', tiles: added });
    },

    // Either person picks up a tile; it's theirs until they drop it, so nobody fights over it.
    'tile:grab'(ws, msg) {
      const role = roleOf(ws);
      const tile = role && ws.room.tiles.get(msg.id);
      if (!tile || !allow(ws, 'tile', POINTER_PER_SECOND)) return;
      if (tile.heldBy && tile.heldBy !== role) return send(ws, { t: 'tile:denied', tile });
      ws.room.zTop += 1;
      tile.z = ws.room.zTop;
      tile.heldBy = role;
      broadcast(ws.room, { t: 'tile:grab', id: tile.id, by: role, z: tile.z });
    },

    'tile:move'(ws, msg) {
      const role = roleOf(ws);
      const tile = role && ws.room.tiles.get(msg.id);
      if (!tile || tile.heldBy !== role || !allow(ws, 'tile', POINTER_PER_SECOND)) return;
      const pos = clampTile(tile.text, msg.x, msg.y);
      if (!pos) return;
      Object.assign(tile, pos);
      send(otherSide(ws.room, role), { t: 'tile:move', id: tile.id, x: tile.x, y: tile.y });
    },

    // Dropping settles the tile (into a sound box, if it lands on a free one) and lets go.
    'tile:drop'(ws, msg) {
      const role = roleOf(ws);
      const room = ws.room;
      const tile = role && room.tiles.get(msg.id);
      if (!tile) return;
      if (tile.heldBy !== role) return send(ws, { t: 'tile:denied', tile });
      Object.assign(tile, clampTile(tile.text, msg.x, msg.y) || {});
      Object.assign(tile, snapTile(tile, room.boxes, [...room.tiles.values()]) || {});
      tile.heldBy = null;
      broadcast(room, { t: 'tile:drop', tile });
    },

    'tile:delete'(ws, msg) {
      if (!isTutor(ws) || !ws.room.tiles.delete(msg.id)) return;
      broadcast(ws.room, { t: 'tile:delete', id: msg.id });
    },

    // Tutor only: swap a tile's letters in place, for word chains (map, mat, sat).
    'tile:edit'(ws, msg) {
      const tile = isTutor(ws) && ws.room.tiles.get(msg.id);
      const text = cleanTileText(msg.text);
      if (!tile || !text) return;
      tile.text = text;
      tile.kind = tileKind(text);
      Object.assign(tile, clampTile(text, tile.x, tile.y));
      broadcast(ws.room, { t: 'tile:edit', tile });
    },

    // Tutor only: every tile back to its home on the tray, packed so there are no gaps.
    'tiles:reset'(ws) {
      if (!isTutor(ws)) return;
      const ordered = [...ws.room.tiles.values()].sort((a, b) => a.order - b.order);
      const placed = [];
      for (const tile of ordered) {
        Object.assign(tile, nextHome(placed, tile.text));
        tile.x = tile.hx;
        tile.y = tile.hy;
        tile.heldBy = null;
        placed.push(tile);
      }
      broadcast(ws.room, { t: 'tiles', tiles: ordered });
    },

    'tiles:clear'(ws) {
      if (!isTutor(ws)) return;
      ws.room.tiles.clear();
      broadcast(ws.room, { t: 'tiles', tiles: [] });
    },

    // Tutor only: show or hide the alphabet strip on both screens.
    'strip:set'(ws, msg) {
      if (!isTutor(ws)) return;
      ws.room.strip = Boolean(msg.on);
      broadcast(ws.room, { t: 'strip:set', on: ws.room.strip });
    },

    // Tutor only: sound boxes off (0) or 2 to 5 of them.
    'boxes:set'(ws, msg) {
      if (!isTutor(ws) || !BOX_COUNTS.includes(msg.count)) return;
      ws.room.boxes = msg.count;
      broadcast(ws.room, { t: 'boxes:set', count: ws.room.boxes });
    },

    // Tutor only, right after a restart: one tile of the board they kept.
    'rs-tile'(ws, msg) {
      const room = ws.room;
      if (!isTutor(ws) || !room.restoring || room.tiles.size >= MAX_TILES) return;
      const t = msg.tile || {};
      const text = cleanTileText(t.text);
      if (!text || !isStrokeId(t.id) || room.tiles.has(t.id)) return;
      const pos = clampTile(text, t.x, t.y);
      const home = clampTile(text, t.hx, t.hy);
      if (!pos || !home) return;
      room.zTop += 1;
      room.order += 1;
      room.tiles.set(t.id, { id: t.id, text, kind: tileKind(text), ...pos, hx: home.x, hy: home.y, z: room.zTop, order: room.order, heldBy: null });
    },

    end(ws) {
      if (ws.room && ws.room.tutor === ws) closeRoom(ws.room, 'ended');
    },

    leave(ws) {
      leaveRoom(ws);
    },
  };

  wss.on('connection', (ws, req) => {
    ws.ip = clientIp(req);
    ws.isAlive = true;
    ws.room = null;
    ws.openStroke = null;
    ws.budget = {};
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg && typeof msg.t === 'string' && Object.hasOwn(handlers, msg.t)) handlers[msg.t](ws, msg);
    });
    ws.on('close', () => leaveRoom(ws));
  });

  // Only this site may open a socket, and only on /ws.
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/ws' || !allowedOrigins.has(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  // Drop connections that stopped answering, and forget old join attempts.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
    const cutoff = Date.now() - joinWindowMs;
    for (const [ip, times] of joinAttempts) if (times.every((t) => t < cutoff)) joinAttempts.delete(ip);
  }, heartbeatMs);
  heartbeat.unref();

  // On shutdown (a deploy), close sockets with 1012 so clients reconnect to the new version.
  const close = () => {
    clearInterval(heartbeat);
    for (const room of rooms.values()) clearTimeout(room.closeTimer);
    for (const ws of wss.clients) ws.close(1012, 'restarting');
    wss.close();
  };

  return { rooms, close };
}
