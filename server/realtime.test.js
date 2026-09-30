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

describe('whiteboard rooms', () => {
  it('only accepts connections from this site', async () => {
    await expect(connect('https://somewhere-else.example')).rejects.toThrow('403');
  });

  it('relays the student pointer to the tutor, clamped, with the letter', async () => {
    const { tutor, code } = await openRoom();
    expect(code).toMatch(/^[0-9]{4}$/);

    const student = await connect();
    student.send({ t: 'join', code });
    expect((await student.take('room')).role).toBe('student');
    expect(await tutor.take('presence')).toMatchObject({ tutor: true, student: true });

    student.send({ t: 'p', x: 0.48, y: 1.7, l: 'M' });
    expect(await tutor.take('p')).toEqual({ t: 'p', x: 0.48, y: 1, l: 'M' });

    student.send({ t: 'p', x: 0.1, y: 0.1, l: 'not a letter' });
    expect((await tutor.take('p')).l).toBeNull();
  });

  it('keeps a second student out but lets the first one take their seat back', async () => {
    const { code } = await openRoom();
    const first = await connect();
    first.send({ t: 'join', code });
    const { key } = await first.take('room');

    const intruder = await connect();
    intruder.send({ t: 'join', code });
    expect((await intruder.take('error')).reason).toBe('room-full');

    const back = await connect();
    back.send({ t: 'join', code, key });
    expect((await back.take('room')).role).toBe('student');
  });

  it('says so when a code does not exist', async () => {
    const student = await connect();
    student.send({ t: 'join', code: '0000' });
    expect((await student.take('error')).reason).toBe('no-room');
  });

  it('lets the tutor reclaim the same code after the server forgets it', async () => {
    const { tutor, code, key } = await openRoom();
    realtime.rooms.delete(code); // as if the server restarted
    tutor.ws.close();
    const back = await connect();
    back.send({ t: 'create', code, key });
    expect(await back.take('room')).toMatchObject({ code, key });
  });

  it('closes the room when the tutor ends it, or leaves and does not come back', async () => {
    const ended = await openRoom();
    const s1 = await connect();
    s1.send({ t: 'join', code: ended.code });
    await s1.take('room');
    ended.tutor.send({ t: 'end' });
    expect((await s1.take('closed')).reason).toBe('ended');

    const left = await openRoom();
    const s2 = await connect();
    s2.send({ t: 'join', code: left.code });
    await s2.take('room');
    left.tutor.ws.close();
    expect((await s2.take('closed', 2000)).reason).toBe('tutor-left');
  });
});
