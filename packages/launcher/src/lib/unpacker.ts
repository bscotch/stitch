/**
 * @file What unpacks the official GameMaker installers on this OS: a
 * user-installed 7-Zip on Windows and macOS, or the launcher itself on
 * Linux (see `platform/deb.ts`).
 */
import {
  resolveOptions,
  type AnyLauncherOptions,
  type ResolvedOptions,
} from './options.ts';
import { findSevenZip, type SevenZipProbe } from './sevenZip.ts';

export interface InstallerUnpacker {
  /** What does the unpacking, e.g. "7-Zip" or "built-in" */
  tool: string;
  /** The external tool's path, if one is needed */
  path?: string;
  /** The external tool's version, if known */
  version?: string;
  /** Unpack an installer into `destDir` (which exists and is empty) */
  unpack(installer: string, destDir: string): Promise<void>;
}

/**
 * Find what can unpack this OS's GameMaker installers. Throws an
 * `UNPACKER_MISSING`/`UNPACKER_INCAPABLE` error, with install instructions,
 * if this OS needs an external tool that isn't available.
 */
export async function findUnpacker(
  options?: AnyLauncherOptions,
  probe?: SevenZipProbe,
): Promise<InstallerUnpacker> {
  const opts: ResolvedOptions = resolveOptions(options);
  const { platform } = opts;
  if (!platform.sevenZip) {
    return {
      tool: 'built-in',
      unpack: (installer, destDir) =>
        platform.unpackInstaller(installer, destDir),
    };
  }
  const sevenZip = await findSevenZip(opts, probe);
  return {
    tool: '7-Zip',
    path: sevenZip.path,
    version: sevenZip.version,
    unpack: (installer, destDir) =>
      platform.unpackInstaller(installer, destDir, sevenZip.path),
  };
}
