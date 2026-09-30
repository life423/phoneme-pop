import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import { attachRealtime } from './realtime.js';

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

export function createApp() {
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
  const server = http.createServer(createApp());
  const realtime = attachRealtime(server, {
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
