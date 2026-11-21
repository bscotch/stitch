import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from './errors.ts';
import { normalizeVersion } from './feed.ts';
import { stripBom } from './fsUtil.ts';
import { findIde, type CachedIde } from './ideCache.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import { computeGameMakerDirs } from './paths.ts';
import type { PlatformLayer } from './platform/types.ts';
import {
  beginUpdatePromptLaunch,
  fileSize,
  finishUpdatePromptLaunch,
  restoreUpdatePrompts,
  updatePromptStateFile,
  waitForUpdateCheck,
} from './updatePrompt.ts';

/** Read the IDE version a project was last saved with, from its `.yyp` */
export async function readProjectIdeVersion(yypPath: string): Promise<string> {
  // .yyp files can have trailing commas, so don't parse them as JSON
  const content = stripBom(await readFile(yypPath, 'utf8'));
  const version = content.match(/"IDEVersion"\s*:\s*"([^"]+)"/)?.[1];
  if (!version) {
    throw new Error(`Could not find the IDE version in "${yypPath}"`);
  }
  return normalizeVersion(version);
}

/**
 * Tracks the processes of one IDE launch by executable path. The IDE's
 * executable relaunches itself (the spawned process exits within seconds),
 * so the spawned PID can't be used. Instead: processes running the same
 * executable that weren't running before the launch, and that appear
 * within the discovery window, belong to this launch.
 */
class IdeProcesses {
  readonly pids = new Set<number>();
  protected readonly platform: PlatformLayer;
  protected readonly executable: string;
  protected readonly before: Set<number>;
  protected readonly discoverUntil: number;

  constructor(
    platform: PlatformLayer,
    executable: string,
    before: Set<number>,
    discoveryMs: number,
  ) {
    this.platform = platform;
    this.executable = executable;
    this.before = before;
    this.discoverUntil = Date.now() + discoveryMs;
  }

  get discovering() {
    return Date.now() < this.discoverUntil;
  }

  /** PIDs of this launch that are currently running */
  async running(): Promise<number[]> {
    const procs = await this.platform.listProcesses(this.executable);
    if (this.discovering) {
      for (const proc of procs) {
        if (!this.before.has(proc.pid)) this.pids.add(proc.pid);
      }
    }
    return procs.map((p) => p.pid).filter((pid) => this.pids.has(pid));
  }
}

export interface RunningIde {
  ide: CachedIde;
  projectPath: string;
  /** PIDs found so far for this launch */
  readonly pids: number[];
  /** Whether the IDE is running (or still starting up) */
  isRunning(): Promise<boolean>;
  /** Resolves once every process of this launch has exited */
  waitForClose(): Promise<void>;
  /** Kill this launch's processes */
  close(): Promise<void>;
}

export interface OpenProjectOptions {
  /** Default: the IDE version the project was last saved with */
  ideVersion?: string;
  /**
   * Stop the IDE from showing "IDE Update Available" on boot. The change
   * is limited to this IDE's channel and is undone right after the IDE's
   * boot-time update check.
   * @default true
   */
  suppressUpdatePrompt?: boolean;
  /** How long to look for the IDE's processes after launch. @default 20000 */
  processDiscoveryMs?: number;
  /** How often `waitForClose` checks the IDE's processes. @default 2000 */
  pollMs?: number;
}

/**
 * Open a project in a cached IDE. The IDE must already be in Stitch's
 * cache (see `installIde`); its runtime is installed by the IDE itself on
 * boot if needed.
 */
export async function openProject(
  yypPath: string,
  options?: AnyLauncherOptions & OpenProjectOptions,
): Promise<RunningIde> {
  const opts = resolveOptions(options);
  const projectPath = path.resolve(yypPath);
  await restoreUpdatePrompts(opts).catch((err) =>
    opts.logger.warn('Could not restore GameMaker update settings', err),
  );
  const ideVersion = options?.ideVersion
    ? normalizeVersion(options.ideVersion)
    : await readProjectIdeVersion(projectPath);
  const ide = await findIde(ideVersion, opts);
  if (!ide) {
    throw new LauncherError(
      'IDE_NOT_FOUND',
      `GameMaker IDE v${ideVersion} is not in Stitch's IDE cache.`,
      { ideVersion },
      { fix: 'Install it first with `installIde`.' },
    );
  }

  const dirs = computeGameMakerDirs(ide.programDirName, opts);
  const shared = await opts.platform.ensureSystemDir(dirs.system);
  if (shared.hint) opts.logger.warn(shared.hint);

  const before = new Set(
    (await opts.platform.listProcesses(ide.executable)).map((p) => p.pid),
  );
  const processes = new IdeProcesses(
    opts.platform,
    ide.executable,
    before,
    options?.processDiscoveryMs ?? 20_000,
  );
  const pollMs = options?.pollMs ?? 2000;

  const suppress = options?.suppressUpdatePrompt ?? true;
  const ctx = { stateFile: updatePromptStateFile(opts) };
  let launchId: string | undefined;
  if (suppress) {
    const logOffset = await fileSize(dirs.ideLog);
    launchId = await beginUpdatePromptLaunch(dirs.defaultMacros, ctx);
    if (!launchId) {
      opts.logger.warn(
        `Could not parse "${dirs.defaultMacros}", so the IDE's update prompt won't be suppressed.`,
      );
    } else {
      void restoreAfterBootCheck(
        dirs.ideLog,
        logOffset,
        dirs.defaultMacros,
        launchId,
        ctx,
        opts,
      );
    }
  }

  try {
    await launch(ide, projectPath);
  } catch (err) {
    if (launchId)
      await finishUpdatePromptLaunch(dirs.defaultMacros, launchId, ctx);
    throw err;
  }
  opts.logger.info(`Opened "${projectPath}" with GameMaker v${ide.version}`);

  const isRunning = async () =>
    (await processes.running()).length > 0 ||
    (processes.discovering && processes.pids.size === 0);

  const running: RunningIde = {
    ide,
    projectPath,
    get pids() {
      return [...processes.pids];
    },
    isRunning,
    async waitForClose() {
      while (await isRunning()) {
        await new Promise((r) => setTimeout(r, pollMs));
      }
    },
    async close() {
      for (const pid of await processes.running()) {
        await opts.platform.killProcess(pid);
      }
    },
  };

  // Also restore when the IDE exits early (e.g. it crashed during boot)
  if (launchId) {
    void running
      .waitForClose()
      .then(() => finishUpdatePromptLaunch(dirs.defaultMacros, launchId, ctx))
      .catch((err) =>
        opts.logger.warn('Could not restore GameMaker update settings', err),
      );
  }
  return running;
}

async function restoreAfterBootCheck(
  logFile: string,
  logOffset: number,
  defaultMacrosFile: string,
  launchId: string,
  ctx: { stateFile: string },
  opts: ResolvedOptions,
) {
  try {
    await waitForUpdateCheck(logFile, logOffset);
    await finishUpdatePromptLaunch(defaultMacrosFile, launchId, ctx);
  } catch (err) {
    opts.logger.warn('Could not restore GameMaker update settings', err);
  }
}

function launch(ide: CachedIde, projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // No shell: the path is passed as a single argument even with spaces.
    const child = spawn(ide.executable, [projectPath], {
      cwd: ide.cwd,
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', (err) =>
      reject(new Error(`Could not start "${ide.executable}"`, { cause: err })),
    );
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
