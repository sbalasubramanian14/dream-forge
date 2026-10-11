import { cliPath, installSkill, pathExists, skillPath } from './skill-install.js';
import { runCommand } from './process.js';
import { getPort } from './client.js';
import { approveCanvasTools } from './canvas-policy.js';

export function parseSetupOptions(args) {
  const [agent, ...flags] = args;
  if (
    !['codex', 'claude', 'cli'].includes(agent) ||
    flags.some((flag) => !['--update', '--approve-canvas'].includes(flag)) ||
    (flags.includes('--approve-canvas') && agent !== 'codex')
  )
    throw new Error('Usage: setup <codex|claude|cli> [--update] [--approve-canvas (Codex only)]');
  return {
    agent,
    update: flags.includes('--update'),
    approveCanvas: flags.includes('--approve-canvas'),
  };
}

export function registrationArgs(agent) {
  const args =
    agent === 'claude' ? ['mcp', 'add', '--transport', 'stdio', '--scope', 'user'] : ['mcp', 'add'];
  if (process.env.DREAM_FORGE_PORT) args.push('--env', `DREAM_FORGE_PORT=${getPort()}`);
  return [...args, 'dream-forge', '--', process.execPath, cliPath, 'mcp'];
}

/** Delegate config ownership to the host CLI; never rewrite a user's config file. */
export async function setupAgent(
  { agent, update = false, approveCanvas = false },
  { run = runCommand, log = console.log, ...locations } = {},
) {
  if (agent === 'cli') {
    log(
      'CLI ready. Run node bin/dream-forge.js start, then create a session in a second terminal.',
    );
    return;
  }
  const version = await run(agent, ['--version']);
  if (version.code !== 0)
    throw new Error(
      `${agent} is unavailable on PATH. Install its CLI first, or use setup cli. ${version.stderr}`,
    );
  const existing = await run(agent, ['mcp', 'get', 'dream-forge']);
  const configuredHere =
    existing.code === 0 &&
    existing.stdout.replaceAll('\\', '/').includes(cliPath.replaceAll('\\', '/'));
  if (existing.code === 0 && !configuredHere && !update)
    throw new Error(
      'Another dream-forge MCP registration exists. Review it with the agent CLI, then use --update to replace it.',
    );
  const target = skillPath(agent, 'user', locations);
  if ((await pathExists(target)) && !update)
    throw new Error(
      `Skill already exists at ${target}. Use --update to refresh bundled instructions.`,
    );
  if (existing.code === 0 && !configuredHere) {
    const removed = await run(
      agent,
      agent === 'claude'
        ? ['mcp', 'remove', '--scope', 'user', 'dream-forge']
        : ['mcp', 'remove', 'dream-forge'],
    );
    if (removed.code !== 0)
      throw new Error(`Could not remove the old registration: ${removed.stderr || removed.stdout}`);
  }
  if (!configuredHere) {
    const added = await run(agent, registrationArgs(agent));
    if (added.code !== 0)
      throw new Error(`MCP registration failed: ${added.stderr || added.stdout}`);
  }
  log(
    `Installed Dream Forge skill at ${await installSkill(agent, 'user', { update, ...locations })}`,
  );
  if (approveCanvas)
    log(
      `Approved local canvas tools in ${await approveCanvasTools()}; other tool policies unchanged.`,
    );
  log(`${agent} MCP ${configuredHere ? 'already points to' : 'registered with'} ${cliPath}`);
  log(
    'Restart your agent session, then ask: Use Dream Forge to explain bubble sort in a fresh canvas.',
  );
}
