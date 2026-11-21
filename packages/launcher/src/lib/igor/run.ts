import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { LauncherError } from '../errors.ts';
import { exists } from '../fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from '../options.ts';
import { computeGameMakerDirs } from '../paths.ts';
import {
  findRuntime,
  listInstalledRuntimes,
  type InstalledRuntime,
} from '../runtimes.ts';
import { findActiveUserDir } from '../user.ts';
import { useIgorCacheEntry, type IgorCacheEntry } from './cache.ts';
import type {
  IgorCliOptions,
  IgorCommandName,
  IgorWorker,
} from './cliTypes.ts';
import {
  buildIgorCommand,
  defaultIgorTarget,
  igorArtifactExtension,
  type IgorCommand,
  type IgorCompiler,
} from './command.ts';

export interface IgorOptions {
  /** Path to the project's `.yyp` file */
  project: string;
  /** An installed runtime, its version, or its dir */
  runtime: InstalledRuntime | string;
  /** @default The current OS */
  target?: IgorWorker;
  /** @default "Run" */
  command?: IgorCommandName | (string & {});
  /** @default "vm" */
  compiler?: IgorCompiler;
  config?: string;
  /**
   * GameMaker user dir (with the licence and devices files).
   * @default The logged-in user of the runtime's channel, else the logged-out user dir
   */
  userDir?: string;
  /** `--tf`: packaged output file. @default `<projectDir>/<projectName>.<ext>` */
  outputFile?: string;
  ignoreCache?: boolean;
  /** @default true */
  verbose?: boolean;
  /** Any other Igor options. These win over the computed ones. */
  extra?: IgorCliOptions;
}

export type PreparedIgorCommand = IgorCommand & {
  runtime: InstalledRuntime;
  cacheEntry: IgorCacheEntry;
};

async function resolveRuntime(
  runtime: InstalledRuntime | string,
  opts: ResolvedOptions,
): Promise<InstalledRuntime> {
  if (typeof runtime !== 'string') return runtime;
  if (/^v?\d+\.\d+\.\d+\.\d+$/.test(runtime.trim())) {
    const found = await findRuntime(runtime, opts);
    if (found) return found;
  } else {
    const dir = opts.platform.path.resolve(runtime);
    const found = (await listInstalledRuntimes(opts)).find(
      (r) => opts.platform.path.resolve(r.directory) === dir,
    );
    if (found) return found;
  }
  throw new LauncherError(
    'RUNTIME_NOT_FOUND',
    `GameMaker runtime "${runtime}" is not installed.`,
    { runtimeVersion: runtime },
    {
      fix: 'Open the project in its GameMaker IDE once, so that the IDE installs its runtime.',
    },
  );
}

/**
 * Resolve everything an Igor command needs: the runtime, the user dir, and
 * the project's Igor cache entry (wiping it on a runtime change and
 * pruning stale entries). Creates the output dirs. Use this to get a
 * command to run elsewhere (e.g. in a terminal); otherwise use
 * {@link runIgor}.
 */
export async function prepareIgorCommand(
  igor: IgorOptions,
  options?: AnyLauncherOptions,
): Promise<PreparedIgorCommand> {
  const opts = resolveOptions(options);
  const p = opts.platform.path;
  const runtime = await resolveRuntime(igor.runtime, opts);
  const project = p.resolve(igor.project);
  const target = igor.target ?? defaultIgorTarget(opts.platform.os);
  const command = igor.command ?? 'Run';

  let userDir = igor.userDir;
  if (!userDir) {
    const userRoot = computeGameMakerDirs(runtime.programDirName, opts).user;
    const active = await findActiveUserDir(userRoot, p.join);
    if (!active.loggedIn) {
      opts.logger.warn(
        `No GameMaker user is logged in for ${runtime.programDirName}, so Igor will use the logged-out user dir. That works for local VM builds, but other targets may need a login.`,
      );
    }
    userDir = active.dir;
  }

  const cache = await useIgorCacheEntry(project, runtime.version, opts);
  const outputFile =
    igor.outputFile ??
    p.join(
      p.dirname(project),
      `${p.basename(project, p.extname(project))}.${igorArtifactExtension(target, command)}`,
    );
  // Packaging fails at the very end if this dir doesn't exist.
  await mkdir(p.dirname(outputFile), { recursive: true });

  return {
    ...buildIgorCommand({
      os: opts.platform.os,
      path: p,
      igorPath: runtime.igorPath,
      runtimeDir: runtime.directory,
      project,
      target,
      command,
      compiler: igor.compiler ?? 'vm',
      config: igor.config,
      userDir,
      cacheDir: cache.cache,
      tempDir: cache.temp,
      outDir: cache.out,
      outputFile,
      ignoreCache: igor.ignoreCache,
      verbose: igor.verbose ?? true,
      extra: igor.extra,
    }),
    runtime,
    cacheEntry: cache.entry,
  };
}

export interface IgorResult {
  exitCode: number | null;
  /** Based on the exit code (for `Run`, it follows the game's exit code) */
  success: boolean;
  stdout: string;
  stderr: string;
  /** stdout and stderr, as written to the log file */
  logFile: string;
  command: PreparedIgorCommand;
}

/** Run Igor. Success is based on its exit code. */
export async function runIgor(
  igor: IgorOptions & {
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
  },
  options?: AnyLauncherOptions,
): Promise<IgorResult> {
  const opts = resolveOptions(options);
  const command = await prepareIgorCommand(igor, opts);
  if (!(await exists(command.cmd))) {
    throw new LauncherError(
      'RUNTIME_NOT_FOUND',
      `Igor was not found at "${command.cmd}".`,
      { runtimeVersion: command.runtime.version },
    );
  }
  const logFile = opts.platform.path.join(
    command.cacheEntry.directory,
    'igor.log',
  );
  const log = createWriteStream(logFile);
  log.write(
    `${command.toShellString(opts.platform.os === 'windows' ? 'powershell' : 'posix')}\n\n`,
  );

  return await new Promise((resolve, reject) => {
    const child = spawn(command.cmd, command.args, {
      cwd: command.cwd,
      env: command.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      log.write(chunk);
      igor.onStdout?.(chunk);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
      log.write(chunk);
      igor.onStderr?.(chunk);
    });
    child.once('error', (err) => {
      log.end();
      reject(err);
    });
    child.once('close', (exitCode) => {
      log.end(() =>
        resolve({
          exitCode,
          success: exitCode === 0,
          stdout,
          stderr,
          logFile,
          command,
        }),
      );
    });
  });
}
