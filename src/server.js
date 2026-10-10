import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from './sessions.js';
import { getCapabilities } from './capabilities.js';
import { sceneSchema } from './schema.js';
import { VERSION } from './version.js';
import { emptyScene } from './schema.js';
import { replaceScene, focusObject, setCamera, performAction, goToStep } from './state.js';
import { constructs } from '../web/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = new Map([
  ['/', ['web/index.html', 'text/html']],
  ['/app.js', ['web/app.js', 'text/javascript']],
  ['/style.css', ['web/style.css', 'text/css']],
  ['/geometry.js', ['web/geometry.js', 'text/javascript']],
  ['/catalog.js', ['web/catalog.js', 'text/javascript']],
  ['/camera-controller.js', ['web/camera-controller.js', 'text/javascript']],
  ['/interactions.js', ['web/interactions.js', 'text/javascript']],
  ['/particle-field.js', ['web/particle-field.js', 'text/javascript']],
  ['/annotations.js', ['web/annotations.js', 'text/javascript']],
  ['/history.js', ['web/history.js', 'text/javascript']],
  ['/particle-transition.js', ['web/particle-transition.js', 'text/javascript']],
  ['/three.js', ['node_modules/three/build/three.module.js', 'text/javascript']],
  ['/three.core.js', ['node_modules/three/build/three.core.js', 'text/javascript']],
  [
    '/OrbitControls.js',
    ['node_modules/three/examples/jsm/controls/OrbitControls.js', 'text/javascript'],
  ],
]);
for (const construct of constructs)
  assets.set(`/examples/${construct.id}.json`, [
    `examples/${construct.id}.json`,
    'application/json',
  ]);

export async function startServer(port = 4317, options = {}) {
  const persist = options.persist ?? process.env.DREAM_FORGE_PERSIST !== '0';
  const directory =
    options.directory ??
    join(process.env.DREAM_FORGE_DATA_DIR || join(homedir(), '.dream-forge'), String(port));
  const store = new SessionStore(persist ? directory : null);
  await store.initialize();
  const clients = new Map();
  const broadcast = (id, state) => {
    for (const [client, sessionId] of clients)
      if (sessionId === id) client.write(`data: ${JSON.stringify(state)}\n\n`);
  };
  const server = createServer(async (req, res) => {
    const json = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowed.includes(req.headers.host))
        return json(403, { error: 'Only local hosts are accepted' });
      if (req.headers.origin && !allowed.map((h) => `http://${h}`).includes(req.headers.origin))
        return json(403, { error: 'Cross-origin requests are not accepted' });
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const path = url.pathname;
      const sessionId = url.searchParams.get('session') || 'local';
      if (req.method === 'GET' && path === '/api/health')
        return json(200, { app: 'dream-forge', version: VERSION });
      if (req.method === 'GET' && path === '/api/capabilities')
        return json(200, await getCapabilities());
      if (req.method === 'GET' && path === '/api/sessions')
        return json(200, { sessions: store.list() });
      if (req.method === 'GET' && path === '/api/state') return json(200, store.state(sessionId));
      if (req.method === 'GET' && path === '/api/history')
        return json(200, { history: store.state(sessionId).history });
      if (req.method === 'GET' && path === '/api/events') {
        const state = store.state(sessionId);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        clients.set(res, sessionId);
        res.write(`data: ${JSON.stringify(state)}\n\n`);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (
        req.method === 'POST' &&
        [
          '/api/scene',
          '/api/focus',
          '/api/clear',
          '/api/camera',
          '/api/action',
          '/api/step',
          '/api/sessions',
          '/api/restore',
          '/api/validate',
          '/api/shutdown',
        ].includes(path)
      ) {
        if (!req.headers['content-type']?.startsWith('application/json'))
          return json(415, { error: 'Use application/json' });
        let body = '';
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 1048576) {
            json(413, { error: 'Payload exceeds 1 MiB' });
            return;
          }
          body += chunk;
        }
        const data = JSON.parse(body || '{}');
        if (path === '/api/shutdown') {
          json(200, { stopped: true });
          setTimeout(() => {
            server.closeAllConnections();
            server.close();
          }, 50).unref();
          return;
        }
        if (path === '/api/sessions') return json(200, await store.create(data));
        if (path === '/api/validate')
          return json(200, { valid: true, scene: sceneSchema.parse(data) });
        if (path === '/api/restore') {
          const state = await store.restore(sessionId, data.id);
          broadcast(sessionId, state);
          return json(200, state);
        }
        const handlers = {
          scene: (state) => replaceScene(state, data),
          clear: (state) => replaceScene(state, emptyScene()),
          focus: (state) => focusObject(state, data.id),
          camera: (state) => setCamera(state, data),
          action: (state) => performAction(state, data.id),
          step: (state) => goToStep(state, data.index),
        };
        const command = path.slice('/api/'.length);
        const state = await store.mutate(sessionId, handlers[command]);
        broadcast(sessionId, state);
        return json(200, state);
      }
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path);
        const content = await readFile(`${root}/${file}`);
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
        return;
      }
      json(404, { error: 'Not found' });
    } catch (error) {
      json(400, { error: error.message });
    }
  });
  const heartbeat = setInterval(() => {
    for (const client of clients.keys()) client.write(': heartbeat\n\n');
  }, 15000);
  heartbeat.unref();
  server.on('close', () => {
    clearInterval(heartbeat);
    for (const client of clients.keys()) client.end();
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    clearInterval(heartbeat);
    throw error;
  }
  return server;
}
