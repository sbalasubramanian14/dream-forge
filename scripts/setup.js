#!/usr/bin/env node
// Dependency-free bootstrap: usable immediately after cloning or extracting a release.
import { repositoryRoot } from '../src/skill-install.js';
import { parseSetupOptions, setupAgent } from '../src/setup.js';
import { runCommand } from '../src/process.js';

try {
  if (Number(process.versions.node.split('.')[0]) < 22)
    throw new Error('Node.js 22 or newer is required.');
  const options = parseSetupOptions(process.argv.slice(2));
  console.log('Installing locked dependencies with npm ci...');
  const installed = await runCommand('npm', ['ci'], { cwd: repositoryRoot, timeout: 300000 });
  process.stdout.write(installed.stdout);
  process.stderr.write(installed.stderr);
  if (installed.code !== 0) throw new Error('Dependency installation failed; setup stopped.');
  await setupAgent(options);
  console.log(
    'Next: node bin/dream-forge.js doctor' + (options.agent === 'cli' ? '' : ' ' + options.agent),
  );
} catch (error) {
  console.error(`Dream Forge setup: ${error.message}`);
  process.exitCode = 1;
}
