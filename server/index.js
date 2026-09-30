import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import { attachRealtime } from './realtime.js';
import { MAX_PICTURE_BYTES } from '../shared/pieces.js';

const PORT = Number(process.env.PORT) || 8080;
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'myprivateteacher.com';
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const ALLOWED_ORIGINS = new Set([
  `https://${CANONICAL_HOST}`,
  'http://localhost:3000',
  'http://localhost:8080',
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : []),
]);

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': `default-src 'self'; connect-src 'self' wss://${CANONICAL_HOST}; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()', // camera and mic for video calls, this site only
};

// What kind of image the bytes really are (never trust the declared type), or null.
export function imageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// `pictures` connects the picture routes to the live rooms (see start()).
export function createApp({ pictures } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  // Every other host (www, the *.azurecontainerapps.io default name) redirects to the canonical one.
  app.use((req, res, next) => {
    if (req.hostname === CANONICAL_HOST || LOCAL_HOSTS.has(req.hostname)) return next();
    res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  });

  app.use(compression());
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });

  // Whiteboard pictures: held in memory for one room, never written anywhere. Only the
  // room's tutor can add one; the address has a random 128-bit id, so it can't be guessed.
  if (pictures) {
    app.post('/api/rooms/:code/pictures/:id', express.raw({ type: () => true, limit: MAX_PICTURE_BYTES }), (req, res) => {
      const type = imageType(req.body);
      if (!type) return res.status(415).json({ ok: false });
      const { status } = pictures.add({
        code: req.params.code,
        id: req.params.id,
        key: req.get('x-room-key'),
        w: Number(req.query.w),
        h: Number(req.query.h),
        type,
        bytes: req.body,
      });
      res.status(status).json({ ok: status < 300 });
    });
    app.get('/api/rooms/:code/pictures/:id', (req, res) => {
      const pic = pictures.get(req.params.code, req.params.id);
      if (!pic) return res.sendStatus(404);
      res.set({ 'Content-Type': pic.type, 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': `default-src 'none'` });
      res.send(pic.bytes);
    });
  }

  // Hashed build assets cache forever; a missing one is a 404, not the app shell.
  app.use(
    '/assets',
    express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y', index: false }),
    (req, res) => res.sendStatus(404),
  );

  // Everything else revalidates on each visit.
  app.use(express.static(DIST, { index: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));

  // Client-side routes (/, /phoneme-pop, /whiteboard/4827, ...) all get the app shell.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });

  return app;
}

export function start(port = PORT) {
  // The picture routes reach the live rooms through this, once the realtime server exists.
  let realtime = null;
  const pictures = {
    add: (upload) => realtime.pictures.add(upload),
    get: (code, id) => realtime.pictures.get(code, id),
  };
  const server = http.createServer(createApp({ pictures }));
  realtime = attachRealtime(server, {
    allowedOrigins: ALLOWED_ORIGINS,
    turn: { host: process.env.TURN_HOST, secret: process.env.TURN_SECRET, tls: process.env.TURN_TLS === 'true' },
  });

  server.listen(port, () => {
    // The container binds port 80 as root, then runs as the unprivileged node user.
    if (process.getuid?.() === 0) {
      try {
        process.setgid('node');
        process.setuid('node');
      } catch (error) {
        console.warn(`Still running as root: ${error.message}`);
      }
    }
    console.log(`My Private Teacher listening on ${port}`);
  });

  const shutdown = () => {
    realtime.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) start();
