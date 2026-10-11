import { spawn } from 'node:child_process';

/** Pass argument arrays without shell interpolation, including Windows CLI shims. */
export function runCommand(command, args = [], { cwd, env = process.env, timeout = 60000 } = {}) {
  let executable = command;
  let parameters = args;
  if (process.platform === 'win32' && !command.endsWith('.exe')) {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const script = `$ProgressPreference = 'SilentlyContinue'; & ${[command, ...args].map(quote).join(' ')}; if ($null -eq $LASTEXITCODE) { exit 1 }; exit $LASTEXITCODE`;
    executable = 'powershell.exe';
    parameters = [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(executable, parameters, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} timed out after ${timeout / 1000}s`));
    }, timeout);
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}
