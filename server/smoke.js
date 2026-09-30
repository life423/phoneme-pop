// Opens a tutor and a student connection against a running site and checks that
// a pointer makes the trip. Usage: node server/smoke.js https://myprivateteacher.com
import WebSocket from 'ws';

const site = new URL(process.argv[2] || 'http://localhost:8080');
const url = `${site.protocol === 'https:' ? 'wss:' : 'ws:'}//${site.host}/ws`;

const open = () =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { origin: site.origin });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });

const next = (ws, type) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for '${type}' from ${url}`)), 5000);
    const onMessage = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.t !== type) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    };
    ws.on('message', onMessage);
  });

const tutor = await open();
tutor.send(JSON.stringify({ t: 'create' }));
const { code } = await next(tutor, 'room');

const student = await open();
student.send(JSON.stringify({ t: 'join', code }));
await next(student, 'room');

const relayed = next(tutor, 'p');
student.send(JSON.stringify({ t: 'p', x: 0.5, y: 0.1, l: 'M' }));
const pointer = await relayed;
if (pointer.l !== 'M' || pointer.x !== 0.5) throw new Error(`pointer arrived as ${JSON.stringify(pointer)}`);

tutor.send(JSON.stringify({ t: 'end' }));
console.log(`Realtime OK: room ${code} relayed a pointer from student to tutor over ${url}`);
tutor.close();
student.close();
