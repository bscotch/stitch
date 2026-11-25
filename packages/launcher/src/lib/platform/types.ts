import type { Platform } from '@bscotch/gamemaker-releases';
import type { PlatformPath } from 'node:path';

export type OsName = 'windows' | 'mac' | 'linux';

/**
 * The parts of the environment that path computations depend on.
 * Injectable so that paths for every OS can be computed (and tested)
 * on any machine.
 */
export interface PlatformEnv {
  homedir: string;
  env: Record<string, string | undefined>;
  /** Node's `os.arch()` value, e.g. "x64" or "arm64" */
  arch: string;
}

/** The special folders that GameMaker's macros are built from */
export interface SpecialFolders {
  /** `${CommonApplicationData}`, the parent of GameMaker's system dirs */
  commonApplicationData: string;
  /** `${ApplicationData}`, the parent of GameMaker's user dirs */
  applicationData: string;
}

/** Where the important parts of a cached IDE are */
export interface IdeLayout {
  programDirName: string;
  /** The executable to run to open a project */
  executable: string;
  /** The working directory to run the executable in */
  cwd: string;
  /** The `matching.runtime` file listing the paired runtime version */
  matchingRuntime: string;
  /** The help-docs keywords file used by the parser */
  helpKeywords: string;
}

export interface RunningProcess {
  pid: number;
  executable: string;
}

/** Output of a child process */
export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** How an OS finds the 7-Zip it needs to extract its installers */
export interface SevenZipRequirement {
  /** The 7-Zip format needed to extract this OS's installers */
  readonly format: 'Nsis' | 'Ar';
  /** The OS-specific command to install a full 7-Zip build */
  readonly installCommand: string;
  /** Executable names to look for on the PATH */
  readonly names: string[];
  /** 7-Zip locations to try after the override and the PATH */
  candidates(env: PlatformEnv): Promise<string[]>;
}

/**
 * Everything that differs between operating systems. One implementation
 * per OS; see `getPlatformLayer`.
 */
export interface PlatformLayer {
  readonly os: OsName;
  /** This OS's key in the releases feed's `downloads` */
  readonly feedPlatform: Platform;
  /**
   * What this OS needs from 7-Zip, or `undefined` if it extracts its
   * installers with built-in tools (macOS uses `pkgutil`).
   */
  readonly sevenZip?: SevenZipRequirement;
  readonly pathDelimiter: string;
  /** Path functions for this OS (so paths can be computed cross-platform) */
  readonly path: PlatformPath;

  specialFolders(env: PlatformEnv): SpecialFolders;
  defaultIgorCacheDir(env: PlatformEnv): string;
  defaultDownloadsDir(env: PlatformEnv): Promise<string>;
  /** Candidate Igor paths inside a runtime dir, best first */
  igorCandidates(runtimeDir: string, arch: string): string[];

  /**
   * Find the IDE inside a cached `gamemaker-<version>` dir.
   * Returns `undefined` if it doesn't look like an IDE dir.
   */
  resolveIdeLayout(
    ideDir: string,
    arch: string,
  ): Promise<IdeLayout | undefined>;
  /**
   * Extract an official installer into `destDir` (which exists and is
   * empty). `sevenZip` is the 7-Zip to use, if this OS has a `sevenZip`
   * requirement.
   */
  extractInstaller(
    installer: string,
    destDir: string,
    sevenZip: string | undefined,
  ): Promise<void>;
  /** Throw if the installer isn't validly signed by YoYo Games */
  verifyInstaller(installer: string): Promise<void>;
  /** Whether the runtime prerequisites the IDE needs are present (Windows: VC++) */
  checkVcRuntime?(): Promise<boolean>;
  /**
   * Make sure a GameMaker system dir exists and is shared the way the
   * official installer would set it up.
   */
  ensureSystemDir(dir: string): Promise<{ created: boolean; hint?: string }>;
  /** Processes currently running the given executable */
  listProcesses(executable: string): Promise<RunningProcess[]>;
  killProcess(pid: number): Promise<void>;
}
