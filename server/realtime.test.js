import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import WebSocket from 'ws';
import { attachRealtime } from './realtime.js';

const ORIGIN = 'http://localhost:8080';
let server;
let realtime;
let url;

beforeAll(async () => {
  server = http.createServer((req, res) => res.end());
  realtime = attachRealtime(server, { allowedOrigins: new Set([ORIGIN]), tutorGraceMs: 150 });
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
