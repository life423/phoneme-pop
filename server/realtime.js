import { WebSocketServer } from 'ws';
import { randomBytes, randomInt } from 'node:crypto';

// Live rooms for the Alphabet Whiteboard: one tutor and one student per room,
// with the student's pointer relayed to the tutor. Rooms live in memory, so the
// app has to run as a single replica.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REPLACED = 4000; // close code: the same person connected again somewhere else

const isCode = (value) =>
  typeof value === 'string' && value.length === 4 && [...value].every((c) => c >= '0' && c <= '9');
const isKey = (value) => typeof value === 'string' && value.length === 32;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

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
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  const send = (ws, msg) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const sendPresence = (room) => {
    const msg = { t: 'presence', tutor: Boolean(room.tutor), student: Boolean(room.student) };
    send(room.tutor, msg);
    send(room.student, msg);
  };

  const closeRoom = (room, reason) => {
    clearTimeout(room.closeTimer);
    rooms.delete(room.code);
    for (const ws of [room.tutor, room.student]) {
      if (!ws) continue;
      ws.room = null;
      send(ws, { t: 'closed', reason });
    }
  };

  const leaveRoom = (ws) => {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    if (room.tutor === ws) {
      room.tutor = null;
      clearTimeout(room.closeTimer);
      room.closeTimer = setTimeout(() => closeRoom(room, 'tutor-left'), tutorGraceMs);
    } else if (room.student === ws) {
      room.student = null;
    }
    sendPresence(room);
  };

  const replace = (oldWs, newWs) => {
    if (!oldWs || oldWs === newWs) return;
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
        };
        rooms.set(code, room);
      }
      if (ws.room !== room) leaveRoom(ws);
      clearTimeout(room.closeTimer);
      replace(room.tutor, ws);
      room.tutor = ws;
      ws.room = room;
      send(ws, { t: 'room', role: 'tutor', code: room.code, key: room.key });
      sendPresence(room);
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
      replace(room.student, ws);
      room.student = ws;
      room.studentKey = returning ? msg.key : randomBytes(16).toString('hex');
      ws.room = room;
      send(ws, { t: 'room', role: 'student', code: room.code, key: room.studentKey });
      sendPresence(room);
    },

    // The student's pointer: 0-1 stage coordinates plus the letter under the fingertip.
    p(ws, msg) {
      const room = ws.room;
      if (!room || room.student !== ws) return;
      const now = Date.now();
      if (now - ws.windowStart >= 1000) {
        ws.windowStart = now;
        ws.pointerCount = 0;
      }
      ws.pointerCount += 1;
      if (ws.pointerCount > 60) return;
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
      const letter = typeof msg.l === 'string' && msg.l.length === 1 && LETTERS.includes(msg.l) ? msg.l : null;
      send(room.tutor, { t: 'p', x: clamp01(msg.x), y: clamp01(msg.y), l: letter });
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
    ws.windowStart = 0;
    ws.pointerCount = 0;
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
