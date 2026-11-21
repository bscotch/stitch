/**
 * @file Find a user-installed *full* 7-Zip build, which Stitch uses to
 * extract the official GameMaker installers. The standalone `7za` build
 * (including the one in the `7zip-bin` npm package) supports none of the
 * needed formats (NSIS, Xar, Ar).
 */
import { execFile } from './exec.ts';
import { LauncherError, sevenZipDownloadUrl } from './errors.ts';
import { exists } from './fsUtil.ts';
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import { splitPath } from './platform/posix.ts';

export interface SevenZipInfo {
  path: string;
  version?: string;
  /** Archive format names it supports, e.g. "Nsis", "Xar", "Ar" */
  formats: string[];
}

/** Parse the version from the banner of 7-Zip's output */
export function parseSevenZipVersion(output: string): string | undefined {
  return (
    output.match(/\b7-Zip(?: \([a-z]\))?\s+(\d+\.\d+)/)?.[1] ??
    output.match(/\bp7zip Version (\d+\.\d+)/)?.[1]
  );
}

/**
 * Parse the format names from the "Formats:" section of `7z i` output.
 * Lines look like ` 0  ...F.G................  Nsis  nsis  offset=4 …`,
 * where the flags column (which may contain a space) is made of dots and
 * letters, and the name is the first column without a dot.
 */
export function parseSevenZipFormats(output: string): string[] {
  const lines = output.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === 'Formats:');
  if (start < 0) return [];
  const formats: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) break;
    const tokens = line.trim().split(/\s+/);
    // The first token is the lib index
    const name = tokens.slice(1).find((t) => !t.includes('.'));
    if (name) formats.push(name);
  }
  return formats;
}

export interface SevenZipProbe {
  exists(path: string): Promise<boolean>;
  /** Output of `<path> i` */
  info(path: string): Promise<string>;
}

const defaultProbe: SevenZipProbe = {
  exists,
  async info(path) {
    const result = await execFile(path, ['i'], { timeoutMs: 15_000 });
    return result.stdout;
  },
};

/** Candidate 7-Zip paths, in the order they should be tried */
export async function listSevenZipCandidates(opts: ResolvedOptions) {
  if (opts.sevenZipPath) return [opts.sevenZipPath];
  const { platform, env } = opts;
  const pathVar = env.env.PATH ?? env.env.Path;
  const onPath = splitPath(pathVar, platform.pathDelimiter).flatMap((dir) =>
    platform.sevenZipNames.map((name) => platform.path.join(dir, name)),
  );
  return [...new Set([...onPath, ...(await platform.sevenZipCandidates(env))])];
}

/**
 * Find a 7-Zip that can extract this OS's GameMaker installers, or throw
 * a `SEVEN_ZIP_MISSING`/`SEVEN_ZIP_INCAPABLE` error with install
 * instructions.
 */
export async function findSevenZip(
  options?: AnyLauncherOptions,
  probe: SevenZipProbe = defaultProbe,
): Promise<SevenZipInfo> {
  const opts = resolveOptions(options);
  const required = opts.platform.sevenZipFormat;
  const found: { path: string; version?: string }[] = [];
  for (const candidate of await listSevenZipCandidates(opts)) {
    if (!(await probe.exists(candidate))) continue;
    let output: string;
    try {
      output = await probe.info(candidate);
    } catch {
      continue;
    }
    const info: SevenZipInfo = {
      path: candidate,
      version: parseSevenZipVersion(output),
      formats: parseSevenZipFormats(output),
    };
    if (info.formats.includes(required)) return info;
    found.push({ path: info.path, version: info.version });
  }

  const data = {
    found,
    requiredFormat: required,
    downloadUrl: sevenZipDownloadUrl,
    installCommand: opts.platform.sevenZipInstallCommand,
  };
  const fix = `Install the full 7-Zip from ${sevenZipDownloadUrl} (or run \`${data.installCommand}\`)${opts.sevenZipPath ? '' : ", or set Stitch's 7-Zip path setting"}.`;
  if (found.length) {
    throw new LauncherError(
      'SEVEN_ZIP_INCAPABLE',
      `Stitch needs a full 7-Zip build with ${required} support to extract GameMaker installers, but found only: ${found.map((f) => `${f.path}${f.version ? ` (v${f.version})` : ''}`).join(', ')}. The standalone "7za" build is not enough.`,
      data,
      { fix },
    );
  }
  throw new LauncherError(
    'SEVEN_ZIP_MISSING',
    opts.sevenZipPath
      ? `7-Zip was not found at "${opts.sevenZipPath}".`
      : 'Stitch needs 7-Zip to extract GameMaker installers, but could not find it.',
    data,
    { fix },
  );
}
