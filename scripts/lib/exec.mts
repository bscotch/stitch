import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';

const isWindows = process.platform === 'win32';

export interface RunOptions {
  cwd?: string;
  /** If true, stream output to the console instead of capturing it. */
  inherit?: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run a command synchronously, returning its trimmed stdout.
 * Throws if the command exits non-zero.
 */
export function run(cmd: string, args: string[], options?: RunOptions): string {
  const execOptions: ExecFileSyncOptions = {
    cwd: options?.cwd,
    env: options?.env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: options?.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    // npm/pnpm are `.cmd` shims on Windows, which require a shell.
    shell: isWindows && cmd !== 'git',
  };
  const output = execFileSync(cmd, args, execOptions);
  return typeof output === 'string' ? output.trim() : '';
}

/** Like {@link run}, but returns `undefined` instead of throwing on failure. */
export function tryRun(
  cmd: string,
  args: string[],
  options?: RunOptions,
): string | undefined {
  try {
    return run(cmd, args, options);
  } catch {
    return undefined;
  }
}
