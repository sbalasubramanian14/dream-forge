import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sceneSchema, emptyScene } from './schema.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = new Map([
  ['/', ['web/index.html', 'text/html']], ['/app.js', ['web/app.js', 'text/javascript']],
  ['/style.css', ['web/style.css', 'text/css']], ['/geometry.js', ['web/geometry.js', 'text/javascript']],
  ['/three.js', ['node_modules/three/build/three.module.js', 'text/javascript']],
  ['/three.core.js', ['node_modules/three/build/three.core.js', 'text/javascript']],
  ['/OrbitControls.js', ['node_modules/three/examples/jsm/controls/OrbitControls.js', 'text/javascript']]
]);

export async function startServer(port = 4317) {
  let state = {scene: emptyScene(), focus: null, revision: 0};
  const clients = new Set();
  const broadcast = () => {
    for (const client of clients) client.write(`data: ${JSON.stringify(state)}\n\n`);
  };
  const server = createServer(async (req, res) => {
    const json = (code, data) => {res.writeHead(code, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));};
    try {
      const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowed.includes(req.headers.host)) return json(403, {error: 'Only local hosts are accepted'});
      if (req.headers.origin && !allowed.map(h => `http://${h}`).includes(req.headers.origin)) return json(403, {error: 'Cross-origin requests are not accepted'});
      const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
      if (req.method === 'GET' && path === '/api/health') return json(200, {app: 'dream-forge', version: '0.1.0'});
      if (req.method === 'GET' && path === '/api/state') return json(200, state);
      if (req.method === 'GET' && path === '/api/events') {
        res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
        clients.add(res); res.write(`data: ${JSON.stringify(state)}\n\n`);
        req.on('close', () => clients.delete(res)); return;
      }
      if (req.method === 'POST' && ['/api/scene', '/api/focus', '/api/clear'].includes(path)) {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, {error: 'Use application/json'});
        let body = ''; let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 131072) {json(413, {error: 'Payload exceeds 128 KiB'}); return;}
          body += chunk;
        }
        const data = JSON.parse(body || '{}');
        if (path === '/api/scene') state = {scene: sceneSchema.parse(data), focus: null, revision: state.revision + 1};
        if (path === '/api/clear') state = {scene: emptyScene(), focus: null, revision: state.revision + 1};
        if (path === '/api/focus') {
          if (data.id !== null && !state.scene.objects.some(o => o.id === data.id)) return json(400, {error: 'Unknown object ID'});
          state = {...state, focus: data.id, revision: state.revision + 1};
        }
        broadcast(); return json(200, state);
      }
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path);
        const content = await readFile(`${root}/${file}`);
        res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'}); res.end(content); return;
      }
      json(404, {error: 'Not found'});
    } catch (error) {json(400, {error: error.message});}
  });
  const heartbeat = setInterval(() => {for (const client of clients) client.write(': heartbeat\n\n');}, 15000);
  heartbeat.unref();
  server.on('close', () => {clearInterval(heartbeat); for (const client of clients) client.end();});
  try {
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
  } catch (error) {clearInterval(heartbeat); throw error;}
  return server;
}
