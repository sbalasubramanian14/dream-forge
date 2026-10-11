import { access, cp, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from './version.js';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const cliPath = resolve(repositoryRoot, 'bin', 'dream-forge.js');

export function skillPath(agent, scope, { cwd = process.cwd(), home = homedir() } = {}) {
  if (!['codex', 'claude'].includes(agent) || !['project', 'user'].includes(scope))
    throw new Error('Usage: install-skill <codex|claude> [project|user] [--update]');
  return resolve(
    scope === 'user' ? home : cwd,
    agent === 'claude' ? '.claude' : '.agents',
    'skills',
    'dream-forge',
  );
}

export async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function installSkill(agent, scope, { update = false, ...locations } = {}) {
  const target = skillPath(agent, scope, locations);
  if ((await pathExists(target)) && !update)
    throw new Error(
      `Skill already exists at ${target}. Repeat with --update to replace bundled files.`,
    );
  await mkdir(resolve(target, '..'), { recursive: true });
  await cp(resolve(repositoryRoot, 'skills', 'dream-forge'), target, {
    recursive: true,
    errorOnExist: !update,
    force: update,
  });
  await writeFile(
    resolve(target, 'installation.json'),
    JSON.stringify(
      { version: VERSION, repository: repositoryRoot, node: process.execPath, cli: cliPath },
      null,
      2,
    ) + '\n',
  );
  return target;
}
