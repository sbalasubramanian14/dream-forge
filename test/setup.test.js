import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSetupOptions, setupAgent } from '../src/setup.js';
import { cliPath, skillPath } from '../src/skill-install.js';
import { runCommand } from '../src/process.js';
import { textScene } from '../src/text-scene.js';
import { approveCanvasTools } from '../src/canvas-policy.js';

test('setup registers absolute MCP arguments for each host and installs skills without clobbering', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dream-forge-setup-'));
  try {
    for (const agent of ['codex', 'claude']) {
      const commands = [];
      const run = async (command, args) => {
        commands.push({ command, args });
        return { code: args[1] === 'get' ? 1 : 0, stdout: '', stderr: '' };
      };
      await setupAgent({ agent }, { home, run, log: () => {} });
      const registration = commands.find((call) => call.args[1] === 'add');
      assert.equal(registration.command, agent);
      assert.deepEqual(registration.args.slice(-4), ['--', process.execPath, cliPath, 'mcp']);
      const target = skillPath(agent, 'user', { home });
      assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /name: dream-forge/);
      assert.equal(
        JSON.parse(await readFile(join(target, 'installation.json'), 'utf8')).cli,
        cliPath,
      );
      await writeFile(join(target, 'my-notes.md'), 'keep');
      commands.length = 0;
      await assert.rejects(setupAgent({ agent }, { home, run, log: () => {} }), /already exists/);
      assert.equal(
        commands.some((call) => call.args[1] === 'add'),
        false,
      );
      await setupAgent({ agent, update: true }, { home, run, log: () => {} });
      assert.equal(await readFile(join(target, 'my-notes.md'), 'utf8'), 'keep');
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('setup requires explicit replacement of an unrelated MCP registration before mutation', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dream-forge-setup-conflict-'));
  const calls = [];
  const run = async (command, args) => {
    calls.push(args);
    return { code: 0, stdout: 'another installation', stderr: '' };
  };
  try {
    await assert.rejects(
      setupAgent({ agent: 'codex' }, { home, run, log: () => {} }),
      /Another dream-forge/,
    );
    assert.equal(
      calls.some((args) => ['add', 'remove'].includes(args[1])),
      false,
    );
    await setupAgent({ agent: 'codex', update: true }, { home, run, log: () => {} });
    assert.ok(calls.find((args) => args[1] === 'remove'));
    assert.ok(calls.find((args) => args[1] === 'add'));
    assert.throws(() => parseSetupOptions(['invalid']), /Usage/);
    assert.throws(() => parseSetupOptions(['codex', '--overwrite-everything']), /Usage/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('process runner preserves spaces, quotes, dollars and shell metacharacters', async () => {
  const argument = "a space ' quote $HOME $(echo wrong) & ;";
  const result = await runCommand(process.execPath, [
    '-e',
    'process.stdout.write(process.argv[1])',
    argument,
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, argument);
});

test('doctor completes a real disposable MCP check without a live canvas', async () => {
  const result = await runCommand(process.execPath, [cliPath, 'doctor'], {
    env: { ...process.env, DREAM_FORGE_PORT: '14327' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /PASS MCP handshake/);
  assert.match(result.stdout, /Connection check passed/);
});

test('particle text fits A–Z into four valid rows and rejects unsupported input', () => {
  const scene = textScene('abcdefghijklmnopqrstuvwxyz');
  assert.equal(scene.objects.length, 4);
  assert.deepEqual(
    scene.objects.map((object) => object.description.length),
    [7, 7, 6, 6],
  );
  assert.equal(
    scene.objects.map((object) => object.description).join(''),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  );
  assert.ok(scene.objects.every((object) => object.points.length > 0));
  assert.throws(() => textScene('💡'), /Unsupported/);
  assert.throws(() => textScene(''), /requires/);
  assert.throws(() => textScene('A'.repeat(145)), /requires/);
  assert.equal(textScene('123-45!').objects.length, 1);
});

test('explicit canvas approval preserves unrelated config and updates only scoped tool policies', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'dream-forge-policy-'));
  const file = join(folder, 'config.toml');
  try {
    await writeFile(
      file,
      'model = "example"\n[mcp_servers.dream-forge]\ncommand = "node"\n[mcp_servers.dream-forge.tools.create_session]\napproval_mode = "prompt"\n\n[mcp_servers.other]\ncommand = "other"\n',
    );
    await approveCanvasTools(file);
    const first = await readFile(file, 'utf8');
    assert.match(first, /model = "example"/);
    assert.match(first, /\[mcp_servers.other\]\ncommand = "other"/);
    assert.match(first, /\[mcp_servers.dream-forge.tools.show_text\]\napproval_mode = "approve"/);
    await approveCanvasTools(file);
    assert.equal(await readFile(file, 'utf8'), first);
    assert.throws(() => parseSetupOptions(['claude', '--approve-canvas']), /Usage/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
