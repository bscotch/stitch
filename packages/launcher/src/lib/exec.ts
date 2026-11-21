import { spawn, type SpawnOptions } from 'node:child_process';
import type { ExecResult } from './platform/types.ts';

/**
 * Run a command without a shell and collect its output. Never rejects
 * because of a non-zero exit code; only if the command can't be started.
 */
export function execFile(
  cmd: string,
  args: string[],
  options?: SpawnOptions & { timeoutMs?: number; input?: string },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      windowsHide: true,
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout!.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr!.setEncoding('utf8').on('data', (d) => (stderr += d));
    const timer = options?.timeoutMs
      ? setTimeout(() => child.kill(), options.timeoutMs)
      : undefined;
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin!.end(options?.input);
  });
}

/**
 * Run a PowerShell script. Values should be passed via `env` (and read as
 * `$env:NAME` in the script) rather than interpolated, to avoid quoting
 * problems.
 */
export async function powershell(
  script: string,
  env?: Record<string, string>,
): Promise<ExecResult> {
  return await execFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { env: { ...process.env, ...env }, timeoutMs: 60_000 },
  );
}
