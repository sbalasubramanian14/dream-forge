import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startServer } from '../src/server.js';
import { request } from '../src/client.js';
import { shapePoint, randomGenerator, shapeNames } from '../web/geometry.js';
import { sceneSchema } from '../src/schema.js';
import { VERSION } from '../src/version.js';
import { constructs } from '../web/catalog.js';

const cli = fileURLToPath(new URL('../bin/dream-forge.js', import.meta.url));
const example = JSON.parse(
  await readFile(new URL('../examples/architecture.json', import.meta.url), 'utf8'),
);
function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], options);
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('HTTP scene lifecycle, CLI, streaming, validation, and local origin restrictions', async () => {
  const port = 14317,
    server = await startServer(port, { persist: false });
  try {
    assert.equal((await request('health', undefined, port)).app, 'dream-forge');
    assert.equal((await request('state', undefined, port)).scene.objects.length, 0);
    const stream = await fetch(`http://127.0.0.1:${port}/api/events`);
    const reader = stream.body.getReader();
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /A space for your next thought/,
    );
    const state = await request('scene', example, port);
    assert.equal(state.scene.objects.length, 3);
    assert.match(new TextDecoder().decode((await reader.read()).value), /Follow a request/);
    await reader.cancel();
    await assert.rejects(
      request('scene', { ...example, objects: [example.objects[0], example.objects[0]] }, port),
      /unique/,
    );
    await assert.rejects(
      request('scene', { ...example, connections: [{ from: 'missing', to: 'api' }] }, port),
      /existing/,
    );
    assert.equal((await request('state', undefined, port)).revision, state.revision);
    assert.equal((await request('focus', { id: 'api' }, port)).focus, 'api');
    const view = await request(
      'camera',
      { view: 'right', zoom: 2, target_id: 'api', auto_rotate: true },
      port,
    );
    assert.equal(view.camera.view, 'right');
    assert.equal(view.focus, 'api');
    assert.equal(view.camera.zoom, 2);
    await assert.rejects(
      request('camera', { view: 'left', target_id: 'missing' }, port),
      /Unknown camera target/,
    );
    await assert.rejects(request('camera', { zoom: 0 }, port));
    assert.equal((await request('state', undefined, port)).revision, view.revision);
    await assert.rejects(request('focus', { id: 'missing' }, port), /Unknown/);
    const blocked = await fetch(`http://127.0.0.1:${port}/api/clear`, {
      method: 'POST',
      headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(blocked.status, 403);
    const unsupported = await fetch(`http://127.0.0.1:${port}/api/clear`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(unsupported.status, 415);
    const demo = await run(['demo', 'portal'], {
      env: { ...process.env, DREAM_FORGE_PORT: String(port) },
    });
    assert.equal(demo.code, 0, demo.stderr);
    assert.equal(JSON.parse(demo.stdout).scene.objects[0].shape, 'ruins');
    assert.equal((await request('clear', {}, port)).scene.objects.length, 0);
    for (const file of [
      '/',
      '/app.js',
      '/three.js',
      '/three.core.js',
      '/OrbitControls.js',
      '/geometry.js',
      '/style.css',
    ])
      assert.equal((await fetch(`http://127.0.0.1:${port}${file}`)).status, 200, file);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('MCP starts a canvas and exposes working tools', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, 'mcp'],
    env: {
      ...process.env,
      DREAM_FORGE_PORT: '14318',
      DREAM_FORGE_PERSIST: '0',
      DREAM_FORGE_SERVER_MODE: 'process',
    },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'dream-forge-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const toolList = (await client.listTools()).tools;
    assert.equal(toolList.length, 14);
    for (const tool of toolList.filter((tool) =>
      ['get_scene', 'get_capabilities', 'list_sessions', 'validate_scene', 'list_history'].includes(
        tool.name,
      ),
    ))
      assert.equal(tool.annotations.readOnlyHint, true);
    const alphabet = await client.callTool({
      name: 'show_text',
      arguments: { text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
    });
    assert.ok(!alphabet.isError);
    assert.equal(JSON.parse(alphabet.content[0].text).rows.join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    assert.ok(alphabet.content[0].text.length < 2000);
    const result = await client.callTool({ name: 'show_scene', arguments: example });
    assert.ok(!result.isError);
    assert.equal(JSON.parse(result.content[0].text).scene.objects.length, 3);
    const sessionId = JSON.parse(result.content[0].text).session.id;
    const focused = await client.callTool({ name: 'focus_object', arguments: { id: 'api' } });
    assert.equal(JSON.parse(focused.content[0].text).focus, 'api');
    const view = await client.callTool({
      name: 'set_camera',
      arguments: { view: 'isometric', target_id: 'api', zoom: 1.5, auto_rotate: true },
    });
    assert.ok(!view.isError);
    assert.equal(JSON.parse(view.content[0].text).camera.auto_rotate, true);
    const capabilities = await client.callTool({ name: 'get_capabilities', arguments: {} });
    assert.ok(!capabilities.isError);
    assert.equal(JSON.parse(capabilities.content[0].text).limits.objects, 24);
    const preflight = await client.callTool({ name: 'validate_scene', arguments: example });
    assert.equal(JSON.parse(preflight.content[0].text).valid, true);
    const second = new Client({ name: 'second-agent', version: '1.0.0' });
    try {
      await second.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [cli, 'mcp'],
          env: {
            ...process.env,
            DREAM_FORGE_PORT: '14318',
            DREAM_FORGE_PERSIST: '0',
            DREAM_FORGE_SERVER_MODE: 'shared',
          },
        }),
      );
      const empty = JSON.parse(
        (await second.callTool({ name: 'get_scene', arguments: {} })).content[0].text,
      );
      assert.notEqual(empty.session.id, sessionId);
      assert.equal(empty.scene.objects.length, 0);
      const created = JSON.parse(
        (
          await second.callTool({
            name: 'create_session',
            arguments: { name: 'Explicit conversation' },
          })
        ).content[0].text,
      );
      assert.equal(created.history.length, 0);
      await second.callTool({
        name: 'show_scene',
        arguments: { session_id: created.session.id, title: 'Other conversation', objects: [] },
      });
      assert.equal((await request('state', undefined, 14318, sessionId)).scene.objects.length, 3);
      const history = JSON.parse(
        (
          await second.callTool({
            name: 'list_history',
            arguments: { session_id: created.session.id },
          })
        ).content[0].text,
      );
      assert.equal(history.history.length, 1);
    } finally {
      await second.close();
    }
    const rejected = await client.callTool({
      name: 'show_scene',
      arguments: { ...example, connections: [{ from: 'missing', to: 'api' }] },
    });
    assert.equal(rejected.isError, true);
    assert.equal((await request('state', undefined, 14318, sessionId)).scene.objects.length, 3);
    const walkthrough = JSON.parse(
      await readFile(new URL('../examples/walkthrough.json', import.meta.url), 'utf8'),
    );
    const guided = await client.callTool({ name: 'show_scene', arguments: walkthrough });
    assert.ok(!guided.isError);
    const next = await client.callTool({ name: 'activate_action', arguments: { id: 'next' } });
    assert.ok(!next.isError);
    assert.equal(JSON.parse(next.content[0].text).step, 0);
    const finalStep = await client.callTool({ name: 'go_to_step', arguments: { index: 2 } });
    assert.ok(!finalStep.isError);
    assert.equal(JSON.parse(finalStep.content[0].text).step, 2);
    const question = await client.callTool({
      name: 'activate_action',
      arguments: { id: 'question' },
    });
    assert.ok(!question.isError);
    assert.equal(JSON.parse(question.content[0].text).interactions.at(-1).type, 'notify');
    await client.callTool({ name: 'clear_canvas', arguments: {} });
    assert.equal((await request('state', undefined, 14318, sessionId)).scene.objects.length, 0);
  } finally {
    await client.close();
  }
});

test('skill installation works from another project and preserves existing installs', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dream-forge-test-'));
  try {
    for (const [agent, folder] of [
      ['codex', '.agents'],
      ['claude', '.claude'],
    ]) {
      const install = await run(['install-skill', agent, 'project'], { cwd });
      assert.equal(install.code, 0, install.stderr);
      assert.match(
        await readFile(join(cwd, folder, 'skills/dream-forge/SKILL.md'), 'utf8'),
        /name: dream-forge/,
      );
      assert.equal((await run(['install-skill', agent, 'project'], { cwd })).code, 1);
      assert.equal((await run(['install-skill', agent, 'project', '--update'], { cwd })).code, 0);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the production MCP daemon survives clients and keeps separate process canvases', async () => {
  const port = 14320;
  const connect = async () => {
    const client = new Client({ name: 'daemon-client', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, 'mcp'],
        env: {
          ...process.env,
          DREAM_FORGE_PORT: String(port),
          DREAM_FORGE_PERSIST: '0',
          DREAM_FORGE_SERVER_MODE: 'daemon',
        },
        stderr: 'pipe',
      }),
    );
    return client;
  };
  let first, second;
  try {
    first = await connect();
    const shown = JSON.parse(
      (await first.callTool({ name: 'show_scene', arguments: example })).content[0].text,
    );
    await first.close();
    first = null;
    assert.equal((await request('health', undefined, port)).version, VERSION);
    second = await connect();
    const fresh = JSON.parse(
      (await second.callTool({ name: 'get_scene', arguments: {} })).content[0].text,
    );
    assert.notEqual(fresh.session.id, shown.session.id);
    assert.equal(fresh.scene.objects.length, 0);
    assert.equal(
      (await request('state', undefined, port, shown.session.id)).scene.objects.length,
      3,
    );
  } finally {
    await first?.close();
    await second?.close();
    await request('shutdown', {}, port).catch(() => {});
  }
});

test('all procedural shapes produce finite samples', () => {
  for (const shape of shapeNames.filter((s) => s !== 'pointcloud')) {
    const random = randomGenerator();
    for (let i = 0; i < 1000; i++) {
      const p = shapePoint(shape, i, random);
      assert.equal(p.length, 3);
      assert.ok(p.every(Number.isFinite), shape);
    }
  }
});

test('all catalog scenes validate and custom point clouds require explicit geometry', async () => {
  for (const construct of constructs)
    sceneSchema.parse(
      JSON.parse(
        await readFile(new URL(`../examples/${construct.id}.json`, import.meta.url), 'utf8'),
      ),
    );
  assert.throws(
    () => sceneSchema.parse({ objects: [{ id: 'custom', shape: 'pointcloud' }] }),
    /requires points/,
  );
  const custom = sceneSchema.parse({
    objects: [
      {
        id: 'custom',
        shape: 'pointcloud',
        points: [
          [0, 0, 0],
          [1, 2, 3],
        ],
        rotation: [0, 1, 0],
      },
    ],
  });
  assert.equal(custom.objects[0].points.length, 2);
  assert.throws(
    () => sceneSchema.parse({ objects: [{ id: 'bad', shape: 'sphere', points: [[0, 0, 0]] }] }),
    /only supported/,
  );
});
