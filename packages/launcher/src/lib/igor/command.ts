import type { PlatformPath } from 'node:path';
import type { OsName } from '../platform/types.ts';
import {
  igorOptionFlags,
  type IgorCliOptions,
  type IgorCommandName,
  type IgorWorker,
} from './cliTypes.ts';

export type IgorCompiler = 'vm' | 'yyc';
export type IgorShell = 'powershell' | 'cmd' | 'posix';

/** Everything needed to build an Igor command, with nothing left to look up */
export interface ResolvedIgorOptions {
  os: OsName;
  path: PlatformPath;
  igorPath: string;
  runtimeDir: string;
  project: string;
  target: IgorWorker;
  command: IgorCommandName | (string & {});
  compiler: IgorCompiler;
  config?: string;
  userDir: string;
  cacheDir: string;
  tempDir: string;
  outDir: string;
  /** `--tf`: where packaged output goes */
  outputFile: string;
  ignoreCache?: boolean;
  verbose?: boolean;
  /** Any other Igor options. These win over the computed ones. */
  extra?: IgorCliOptions;
  /** The environment to run Igor in. @default process.env */
  env?: NodeJS.ProcessEnv;
}

export interface IgorCommand {
  cmd: string;
  /** Raw arguments, for spawning without a shell */
  args: string[];
  /** The environment to run Igor in */
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** The command line, quoted for a shell (e.g. to send to a terminal) */
  toShellString(shell: IgorShell): string;
}

/** The default build target for the current OS */
export function defaultIgorTarget(os: OsName): IgorWorker {
  return os;
}

/** The file extension for packaged output, per target and command */
export function igorArtifactExtension(target: IgorWorker, command: string) {
  if (target === 'windows' && /Nsis/.test(command)) return 'exe';
  switch (target) {
    case 'android':
    case 'amazonfire':
      return 'aab';
    case 'ios':
    case 'tvos':
      return 'ipa';
    case 'switch':
    case 'switch2':
      return 'nsp';
    case 'ps4':
    case 'ps5':
      return 'pkg';
    case 'xboxseriesxs':
      return 'xboxseriesxs-pkg';
    default:
      return 'zip';
  }
}

/** Render Igor options as `--name=value` / `--flag` arguments */
export function igorOptionArgs(options: IgorCliOptions): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === false || value === null) continue;
    const spec = igorOptionFlags[key as keyof IgorCliOptions] as
      { flag: string; takesValue: boolean } | undefined;
    const flag = spec?.flag ?? (key.length === 1 ? `-${key}` : `--${key}`);
    if (value === true) args.push(flag);
    else args.push(`${flag}=${value}`);
  }
  return args;
}

/** Build an Igor command. Pure: no filesystem access. */
export function buildIgorCommand(options: ResolvedIgorOptions): IgorCommand {
  const p = options.path;
  const projectName = p.basename(options.project, p.extname(options.project));
  const computed: IgorCliOptions = {
    project: options.project,
    user: options.userDir,
    runtimePath: options.runtimeDir,
    runtime: options.compiler === 'yyc' ? 'YYC' : 'VM',
    config: options.config,
    verbose: options.verbose,
    ignorecache: options.ignoreCache,
    cache: options.cacheDir,
    temp: options.tempDir,
    // Igor requires a file name here, but only uses its dir.
    of: p.join(options.outDir, `${projectName}.win`),
    tf: options.outputFile,
  };
  const args = [
    ...igorOptionArgs({ ...computed, ...options.extra }),
    '--',
    options.target,
    options.command,
  ];

  const env = { ...(options.env ?? process.env) };
  if (options.os === 'windows') {
    // The PATH that Node passes along conflicts with MSBuild.
    // See https://github.com/dotnet/msbuild/issues/5726
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'path') delete env[key];
    }
  }

  const cmd = options.igorPath;
  return {
    cmd,
    args,
    env,
    cwd: p.dirname(options.project),
    toShellString: (shell) => formatShellCommand(cmd, args, shell),
  };
}

/** Quote a command and its arguments for a shell */
export function formatShellCommand(
  cmd: string,
  args: string[],
  shell: IgorShell,
) {
  switch (shell) {
    case 'posix': {
      const q = (s: string) =>
        /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
      return [cmd, ...args].map(q).join(' ');
    }
    case 'powershell': {
      // Quote everything (including `--`, which PowerShell may otherwise
      // treat specially), and use the call operator so a quoted command runs.
      const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
      return ['&', q(cmd), ...args.map(q)].join(' ');
    }
    case 'cmd': {
      const q = (s: string) =>
        /^[\w@+=:,./\\-]+$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`;
      return [cmd, ...args].map(q).join(' ');
    }
  }
}
