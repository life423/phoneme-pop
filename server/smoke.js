// Opens a tutor and a student connection against a running site and checks that
// a pointer and a pen stroke make the trip. Usage: node server/smoke.js https://myprivateteacher.com
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

const say = (ws, msg) => ws.send(JSON.stringify(msg));

const tutor = await open();
const created = next(tutor, 'room');
say(tutor, { t: 'create' });
const { code } = await created;

const student = await open();
const joined = next(student, 'room');
say(student, { t: 'join', code });
await joined;

const pointed = next(tutor, 'p');
say(student, { t: 'p', x: 0.5, y: 0.1, l: 'M', m: 'hand' });
const pointer = await pointed;
if (pointer.l !== 'M' || pointer.x !== 0.5) throw new Error(`pointer arrived as ${JSON.stringify(pointer)}`);

const toolsOn = next(student, 'tools');
say(tutor, { t: 'tools', on: true });
await toolsOn;

const drawn = next(tutor, 's');
say(student, { t: 's', id: 'smoke', tool: 'pen', x: 400, y: 500 });
const stroke = await drawn;
if (stroke.by !== 'student' || stroke.tool !== 'pen') throw new Error(`stroke arrived as ${JSON.stringify(stroke)}`);
say(student, { t: 'e', id: 'smoke' });

say(tutor, { t: 'end' });
console.log(`Realtime OK: room ${code} relayed a pointer and a pen stroke over ${url}`);
tutor.close();
student.close();
