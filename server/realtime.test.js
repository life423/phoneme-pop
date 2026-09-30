import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import WebSocket from 'ws';
import { createHmac } from 'node:crypto';
import { attachRealtime } from './realtime.js';

const ORIGIN = 'http://localhost:8080';
let server;
let realtime;
let url;

beforeAll(async () => {
  server = http.createServer((req, res) => res.end());
  realtime = attachRealtime(server, { allowedOrigins: new Set([ORIGIN]), tutorGraceMs: 150, joinAttemptsPerWindow: 1000, maxRoomsPerIp: 1000, turn: { host: 'turn.example', secret: 'test-secret', tls: true } });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `ws://localhost:${server.address().port}/ws`;
});

afterAll(() => {
  realtime.close();
  server.close();
});

// Waits for (and removes) the first message of a given type.
function take(inbox, type, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const i = inbox.findIndex((m) => m.t === type);
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]);
      if (Date.now() - started > timeout) return reject(new Error(`no '${type}' message`));
      setTimeout(check, 5);
    };
    check();
  });
}

function connect(origin = ORIGIN) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { origin });
    const inbox = [];
    ws.on('message', (data) => inbox.push(JSON.parse(data.toString())));
    ws.once('error', reject);
    ws.once('open', () =>
      resolve({
        ws,
        send: (msg) => ws.send(JSON.stringify(msg)),
        take: (type, timeout) => take(inbox, type, timeout),
      }),
    );
  });
}

async function openRoom() {
  const tutor = await connect();
  tutor.send({ t: 'create' });
  const room = await tutor.take('room');
  await tutor.take('presence');
  return { tutor, ...room };
}

async function joinRoom(code, key) {
  const student = await connect();
  student.send({ t: 'join', code, key });
  const room = await student.take('room');
  const board = await student.take('board');
  return { student, key: room.key, board };
}

async function withTools() {
  const { tutor, code, key } = await openRoom();
  const { student } = await joinRoom(code);
  tutor.send({ t: 'tools', on: true });
  await student.take('tools');
  return { tutor, student, code, key };
}

// For things the server must ignore: no message of this type turns up.
const nothing = (client, type) => expect(client.take(type, 150)).rejects.toThrow();

describe('whiteboard rooms', () => {
  it('only accepts connections from this site', async () => {
    await expect(connect('https://somewhere-else.example')).rejects.toThrow('403');
  });

  it('relays pointers both ways, clamped, with the letter and the tool', async () => {
    const { tutor, code } = await openRoom();
    expect(code).toMatch(/^[0-9]{4}$/);
    const { student } = await joinRoom(code);
    expect(await tutor.take('presence')).toMatchObject({ tutor: true, student: true });

    student.send({ t: 'p', x: 0.48, y: 1.7, l: 'M', m: 'hand' });
    expect(await tutor.take('p')).toEqual({ t: 'p', x: 0.48, y: 1, l: 'M', m: 'hand' });

    student.send({ t: 'p', x: 0.1, y: 0.1, l: 'not a letter' });
    expect((await tutor.take('p')).l).toBeNull();

    tutor.send({ t: 'p', x: 0.5, y: 0.5, m: 'pen' });
    expect(await student.take('p')).toMatchObject({ x: 0.5, y: 0.5, l: null, m: 'pen' });
    tutor.send({ t: 'p', m: 'none' });
    expect(await student.take('p')).toEqual({ t: 'p', m: 'none' });
  });

  it('keeps a second student out but lets the first one take their seat back', async () => {
    const { code } = await openRoom();
    const first = await joinRoom(code);

    const intruder = await connect();
    intruder.send({ t: 'join', code });
    expect((await intruder.take('error')).reason).toBe('room-full');

    const back = await joinRoom(code, first.key);
    expect(back.key).toBe(first.key);
  });

  it('says so when a code does not exist', async () => {
    const student = await connect();
    student.send({ t: 'join', code: '0000' });
    expect((await student.take('error')).reason).toBe('no-room');
  });

  it('closes the room when the tutor ends it, or leaves and does not come back', async () => {
    const ended = await openRoom();
    const s1 = await joinRoom(ended.code);
    ended.tutor.send({ t: 'end' });
    expect((await s1.student.take('closed')).reason).toBe('ended');

    const left = await openRoom();
    const s2 = await joinRoom(left.code);
    left.tutor.ws.close();
    expect((await s2.student.take('closed', 2000)).reason).toBe('tutor-left');
  });
});

describe('drawing', () => {
  it('keeps the student off the board until the tutor turns tools on', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);

    student.send({ t: 's', id: 'early', tool: 'pen', x: 100, y: 300 });
    await nothing(tutor, 's');

    tutor.send({ t: 'tools', on: true });
    expect(await student.take('tools')).toEqual({ t: 'tools', on: true });

    student.send({ t: 's', id: 's1', tool: 'pen', x: 100, y: 300 });
    expect(await tutor.take('s')).toMatchObject({ id: 's1', by: 'student', tool: 'pen', x: 100, y: 300 });
    expect((await student.take('ack')).id).toBe('s1');
    student.send({ t: 'm', id: 's1', pts: [150, 320, 5000, -20] });
    expect((await tutor.take('m')).pts).toEqual([150, 320, 1600, 0]);
    student.send({ t: 'e', id: 's1' });
    expect(await tutor.take('e')).toEqual({ t: 'e', id: 's1' });
  });

  it('lets each person undo only their own strokes', async () => {
    const { tutor, student } = await withTools();
    tutor.send({ t: 's', id: 't1', tool: 'pen', x: 200, y: 300 });
    tutor.send({ t: 'e', id: 't1' });
    student.send({ t: 's', id: 's1', tool: 'pen', x: 300, y: 300 });
    student.send({ t: 'e', id: 's1' });
    await tutor.take('e');
    await student.take('e');

    student.send({ t: 'undo' });
    expect((await tutor.take('undo')).id).toBe('s1');
    expect((await student.take('undo')).id).toBe('s1');

    student.send({ t: 'undo' }); // nothing of theirs is left
    await nothing(tutor, 'undo');

    tutor.send({ t: 'undo' });
    expect((await student.take('undo')).id).toBe('t1');
  });

  it('keeps erasing in order, so undoing an erase brings the ink back', async () => {
    const { tutor, code } = await openRoom();
    tutor.send({ t: 's', id: 'ink', tool: 'pen', x: 400, y: 400 });
    tutor.send({ t: 'm', id: 'ink', pts: [500, 400] });
    tutor.send({ t: 'e', id: 'ink' });
    tutor.send({ t: 's', id: 'rub', tool: 'eraser', x: 450, y: 400 });
    tutor.send({ t: 'e', id: 'rub' });
    await tutor.take('ack');
    await tutor.take('ack');

    const first = await joinRoom(code);
    expect(first.board.strokes.map((s) => [s.id, s.tool])).toEqual([
      ['ink', 'pen'],
      ['rub', 'eraser'],
    ]);

    tutor.send({ t: 'undo' });
    expect((await first.student.take('undo')).id).toBe('rub');

    const again = await joinRoom(code, first.key);
    expect(again.board.strokes.map((s) => s.id)).toEqual(['ink']);
    expect(again.board.strokes[0].pts).toEqual([400, 400, 500, 400]);
  });

  it('stops the student mid-stroke when the tutor turns tools off', async () => {
    const { tutor, student } = await withTools();
    student.send({ t: 's', id: 's1', tool: 'pen', x: 100, y: 300 });
    await tutor.take('s');

    tutor.send({ t: 'tools', on: false });
    expect(await tutor.take('e')).toEqual({ t: 'e', id: 's1' });
    expect(await student.take('tools')).toEqual({ t: 'tools', on: false });

    student.send({ t: 'm', id: 's1', pts: [120, 320] });
    student.send({ t: 'undo' });
    await nothing(tutor, 'm');
    await nothing(tutor, 'undo');
  });

  it('clears the board for both, and only the tutor can', async () => {
    const { tutor, student } = await withTools();
    tutor.send({ t: 's', id: 't1', tool: 'pen', x: 200, y: 300 });
    await student.take('s');

    student.send({ t: 'clear' });
    await nothing(student, 'board');

    tutor.send({ t: 'clear' });
    expect((await student.take('board')).strokes).toEqual([]);
    expect((await tutor.take('board')).strokes).toEqual([]);
  });

  it('gets the board back from the tutor after a restart', async () => {
    const { tutor, student, code, key } = await withTools();
    tutor.send({ t: 's', id: 't1', tool: 'pen', x: 200, y: 300 });
    student.send({ t: 's', id: 's1', tool: 'pen', x: 300, y: 300 });
    await tutor.take('s');
    await student.take('s');

    realtime.rooms.delete(code); // the server restarts and forgets everything
    tutor.ws.close();
    student.ws.close();

    const back = await connect();
    back.send({ t: 'create', code, key });
    expect(await back.take('room')).toMatchObject({ code, key, fresh: true });
    back.send({ t: 'rs', id: 't1', by: 'tutor', tool: 'pen', pts: [200, 300] });
    back.send({ t: 'rs', id: 's1', by: 'student', tool: 'pen', pts: [300, 300] });
    back.send({ t: 'restored', tools: true });
    const board = await back.take('board');
    expect(board.tools).toBe(true);
    expect(board.strokes.map((s) => [s.id, s.by])).toEqual([
      ['t1', 'tutor'],
      ['s1', 'student'],
    ]);

    const rejoined = await joinRoom(code);
    expect(rejoined.board.strokes).toHaveLength(2);
    expect(rejoined.board.tools).toBe(true);
  });
});

describe('pointers', () => {
  it('lets the tutor move the student’s hand, but never the other way round', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);
    tutor.send({ t: 'move', x: 0.25, y: 0.1, l: 'G' });
    expect(await student.take('moved')).toEqual({ t: 'moved', x: 0.25, y: 0.1, l: 'G' });

    student.send({ t: 'move', x: 0.9, y: 0.9 });
    await nothing(tutor, 'moved');
    await nothing(tutor, 'p');
  });

  it('shows a returning tutor where the student is pointing', async () => {
    const { tutor, code, key } = await openRoom();
    const { student } = await joinRoom(code);
    student.send({ t: 'p', x: 0.3, y: 0.08, l: 'H', m: 'hand' });
    await tutor.take('p');

    const back = await connect(); // the tutor refreshes: same code and key, new connection
    back.send({ t: 'create', code, key });
    await back.take('room');
    expect(await back.take('p')).toMatchObject({ x: 0.3, y: 0.08, l: 'H', m: 'hand' });
  });
});

describe('letter tiles', () => {
  let n = 0;
  const addTiles = async (tutor, texts) => {
    tutor.send({ t: 'tile:add', tiles: texts.map((text) => ({ id: `tile${(n += 1)}`, text })) });
    return (await tutor.take('tile:add')).tiles;
  };

  it('only the tutor adds tiles, and they line up on the tray for both', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);
    student.send({ t: 'tile:add', tiles: [{ id: 'sneaky', text: 'z' }] });
    await nothing(tutor, 'tile:add');

    const tiles = await addTiles(tutor, ['sh', 'i', 'p', 'bad!']);
    expect(tiles.map((t) => [t.text, t.kind])).toEqual([
      ['sh', 'team'],
      ['i', 'vowel'],
      ['p', 'consonant'],
    ]);
    expect(tiles.every((t) => t.y === 848 && t.x === t.hx)).toBe(true);
    expect((await student.take('tile:add')).tiles).toHaveLength(3);
  });

  it('streams a drag live, and holds the tile for whoever is dragging it', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);
    const [tile] = await addTiles(tutor, ['c']);
    await student.take('tile:add');

    student.send({ t: 'tile:grab', id: tile.id });
    expect(await tutor.take('tile:grab')).toMatchObject({ id: tile.id, by: 'student' });
    student.send({ t: 'tile:move', id: tile.id, x: 600, y: 600 });
    expect(await tutor.take('tile:move')).toEqual({ t: 'tile:move', id: tile.id, x: 600, y: 600 });

    tutor.send({ t: 'tile:grab', id: tile.id }); // the student has it
    expect((await tutor.take('tile:denied')).tile.heldBy).toBe('student');
    tutor.send({ t: 'tile:move', id: tile.id, x: 100, y: 100 });
    await nothing(student, 'tile:move');

    student.send({ t: 'tile:drop', id: tile.id, x: 5000, y: 610 });
    expect((await tutor.take('tile:drop')).tile).toMatchObject({ x: 1576 - 84, y: 610, heldBy: null });
  });

  it('snaps a tile into a free sound box when it is dropped there', async () => {
    const { tutor } = await openRoom();
    tutor.send({ t: 'boxes:set', count: 3 });
    expect((await tutor.take('boxes:set')).count).toBe(3);
    const [sh, i] = await addTiles(tutor, ['sh', 'i']);

    tutor.send({ t: 'tile:grab', id: sh.id });
    tutor.send({ t: 'tile:drop', id: sh.id, x: 500, y: 240 });
    expect((await tutor.take('tile:drop')).tile).toMatchObject({ x: 514, y: 225 });

    tutor.send({ t: 'tile:grab', id: i.id });
    tutor.send({ t: 'tile:drop', id: i.id, x: 520, y: 230 }); // same box, already taken
    expect((await tutor.take('tile:drop')).tile).toMatchObject({ x: 520, y: 230 });
  });

  it('keeps tile management and board settings with the tutor', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);
    const [m, a] = await addTiles(tutor, ['m', 'a', 'p']);

    for (const msg of [
      { t: 'tile:delete', id: m.id },
      { t: 'tiles:clear' },
      { t: 'tiles:reset' },
      { t: 'strip:set', on: false },
      { t: 'boxes:set', count: 4 },
      { t: 'tile:edit', id: m.id, text: 'x' },
    ]) {
      student.send(msg);
    }
    await nothing(tutor, 'tile:delete');
    await nothing(tutor, 'tiles');
    await nothing(tutor, 'strip:set');

    tutor.send({ t: 'tile:edit', id: a.id, text: 'o' }); // map becomes mop
    expect((await student.take('tile:edit')).tile).toMatchObject({ id: a.id, text: 'o', kind: 'vowel' });
    tutor.send({ t: 'tile:delete', id: m.id });
    expect((await student.take('tile:delete')).id).toBe(m.id);
    tutor.send({ t: 'tiles:reset' });
    expect((await student.take('tiles')).tiles.map((t) => [t.text, t.x])).toEqual([
      ['o', 48],
      ['p', 148],
    ]);
    tutor.send({ t: 'strip:set', on: false });
    expect(await student.take('strip:set')).toEqual({ t: 'strip:set', on: false });
    tutor.send({ t: 'tiles:clear' });
    expect((await student.take('tiles')).tiles).toEqual([]);
  });

  it('gives late joiners the tiles and settings, and gets them back after a restart', async () => {
    const { tutor, code, key } = await openRoom();
    tutor.send({ t: 'strip:set', on: false });
    tutor.send({ t: 'boxes:set', count: 3 });
    const [tile] = await addTiles(tutor, ['ck']);
    const late = await joinRoom(code);
    expect(late.board).toMatchObject({ strip: false, boxes: 3 });
    expect(late.board.tiles.map((t) => t.text)).toEqual(['ck']);

    realtime.rooms.delete(code); // the server restarts and forgets everything
    late.student.ws.close();
    const back = await connect();
    back.send({ t: 'create', code, key });
    expect(await back.take('room')).toMatchObject({ fresh: true });
    back.send({ t: 'rs-tile', tile });
    back.send({ t: 'restored', tools: false, strip: false, boxes: 3 });
    const board = await back.take('board');
    expect(board).toMatchObject({ strip: false, boxes: 3 });
    expect(board.tiles.map((t) => [t.text, t.x, t.y])).toEqual([['ck', tile.x, tile.y]]);
  });
});

describe('video call setup', () => {
  it('passes call setup between the two people in a room, and nobody else', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);
    const outsider = await openRoom();

    tutor.send({ t: 'rtc:ready' });
    expect(await student.take('rtc:ready')).toEqual({ t: 'rtc:ready' });

    const offer = { type: 'offer', sdp: 'v=0 fake offer' };
    student.send({ t: 'rtc:description', description: offer });
    expect((await tutor.take('rtc:description')).description).toEqual(offer);

    const candidate = { candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    tutor.send({ t: 'rtc:candidate', candidate });
    expect((await student.take('rtc:candidate')).candidate).toMatchObject(candidate);
    await nothing(outsider.tutor, 'rtc:candidate');
  });

  it('drops malformed or oversized call messages', async () => {
    const { tutor, code } = await openRoom();
    const { student } = await joinRoom(code);
    tutor.send({ t: 'rtc:description', description: { type: 'offer', sdp: 'x'.repeat(20001) } });
    tutor.send({ t: 'rtc:description', description: { type: 'pranswer', sdp: 'v=0' } });
    tutor.send({ t: 'rtc:candidate', candidate: { candidate: 42 } });
    await nothing(student, 'rtc:description');
    await nothing(student, 'rtc:candidate');
  });

  it('hands out TURN logins that expire and that the relay can verify', async () => {
    const { tutor, code } = await openRoom();
    tutor.send({ t: 'rtc:config' });
    const { iceServers } = await tutor.take('rtc:config');
    expect(iceServers[0]).toEqual({ urls: 'stun:turn.example:3478' });
    const relay = iceServers[1];
    expect(relay.urls).toContain('turns:turn.example:443?transport=tcp');
    const [expires, user] = relay.username.split(':');
    expect(user).toBe(`${code}-tutor`);
    expect(Number(expires)).toBeGreaterThan(Date.now() / 1000);
    expect(relay.credential).toBe(createHmac('sha1', 'test-secret').update(relay.username).digest('base64'));
  });
});
