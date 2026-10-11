import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { cliPath, skillPath, pathExists } from './skill-install.js';
import { runCommand } from './process.js';
import { VERSION } from './version.js';
import { request, getPort } from './client.js';

async function freePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

/** Probe a disposable MCP process and canvas, never the user's saved scenes. */
export async function diagnose(agent, { log = console.log } = {}) {
  if (agent && !['codex', 'claude'].includes(agent))
    throw new Error('Usage: doctor [codex|claude]');
  log(`Dream Forge ${VERSION} · Node ${process.versions.node}`);
  if (Number(process.versions.node.split('.')[0]) < 22)
    throw new Error('Node.js 22 or newer is required.');
  if (agent) {
    const result = await runCommand(agent, ['mcp', 'get', 'dream-forge']);
    if (
      result.code !== 0 ||
      !result.stdout.replaceAll('\\', '/').includes(cliPath.replaceAll('\\', '/'))
    )
      throw new Error(
        `${agent} does not register this clone. Run setup ${agent} (or --update for an existing installation).`,
      );
    if (!(await pathExists(skillPath(agent, 'user'))))
      throw new Error(
        `Missing ${agent} user skill. Run setup ${agent}. Project skills can be checked manually.`,
      );
    log(`PASS ${agent} registration and user skill`);
  }
  const port = await freePort();
  const client = new Client({ name: 'dream-forge-doctor', version: VERSION });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, 'mcp'],
    env: {
      ...process.env,
      DREAM_FORGE_PORT: String(port),
      DREAM_FORGE_SESSION: 'doctor',
      DREAM_FORGE_PERSIST: '0',
      DREAM_FORGE_SERVER_MODE: 'process',
    },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const required of [
      'get_capabilities',
      'create_session',
      'validate_scene',
      'show_scene',
      'get_scene',
    ])
      if (!names.includes(required)) throw new Error(`MCP is missing ${required}`);
    const call = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) throw new Error(result.content[0].text);
      return JSON.parse(result.content[0].text);
    };
    await call('get_capabilities');
    const state = await call('create_session', { name: 'Connection check' });
    const scene = {
      session_id: state.session.id,
      title: 'Connection check',
      objects: [{ id: 'probe', shape: 'sphere', position: [0, 0, 0] }],
    };
    if (!(await call('validate_scene', scene)).valid) throw new Error('Scene validation failed.');
    await call('show_scene', scene);
    if ((await call('get_scene', { session_id: state.session.id })).scene.objects.length !== 1)
      throw new Error('Scene delivery failed.');
    for (const path of [
      '/',
      '/app.js',
      '/three.js',
      '/three.core.js',
      '/OrbitControls.js',
      '/style.css',
    ]) {
      if (!(await fetch(`http://127.0.0.1:${port}${path}`)).ok)
        throw new Error(`Missing browser asset ${path}`);
    }
    log(`PASS MCP handshake, ${names.length} tools, validation, scene delivery and browser assets`);
  } finally {
    await client.close();
  }
  try {
    const health = await request('health');
    log(
      health.app === 'dream-forge' && health.version === VERSION
        ? `PASS running canvas on port ${getPort()}`
        : `NOTE port ${getPort()} has a different application/version; restart or choose another port.`,
    );
  } catch {
    log(`NOTE no canvas reachable on port ${getPort()}; MCP will start one when connected.`);
  }
  log(
    'Connection check passed. Open the session URL in a WebGL-enabled browser to verify graphics.',
  );
}
