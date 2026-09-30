import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './index.js';

// Needs a build in dist/ (npm run build) first.
let server;
let port;

beforeAll(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

afterAll(() => server.close());

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path, headers: { host: 'localhost', ...headers } }, (res) => {
      let body = '';
      res.setEncoding('latin1');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
  });
}

describe('web server', () => {
  it('sends other hosts to the canonical domain, keeping the path', async () => {
    const res = await get('/whiteboard/1234?x=1', { host: 'www.myprivateteacher.com' });
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://myprivateteacher.com/whiteboard/1234?x=1');
  });

  it('serves every app route with the shell, security headers and no-cache', async () => {
    for (const path of ['/', '/phoneme-pop', '/whiteboard', '/whiteboard/4827']) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.body).toContain('root');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['content-security-policy']).toContain(`default-src 'self'`);
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('gzips and caches hashed assets forever, and 404s missing ones', async () => {
    const html = readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8');
    const script = html
      .split('/assets/')
      .slice(1)
      .map((s) => s.slice(0, s.search(/[^A-Za-z0-9._-]/)))
      .find((s) => s.endsWith('.js'));
    const res = await get(`/assets/${script}`, { 'accept-encoding': 'gzip' });
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['cache-control']).toContain('immutable');
    expect((await get('/assets/nope.js')).status).toBe(404);
  });

  it('answers health checks on any host without redirecting', async () => {
    expect((await get('/healthz', { host: '10.0.0.5' })).status).toBe(200);
  });
});

describe('video calls', () => {
  it('lets this site, and only this site, use the camera and microphone', async () => {
    const policy = (await get('/')).headers['permissions-policy'];
    expect(policy).toContain('camera=(self)');
    expect(policy).toContain('microphone=(self)');
  });
});
