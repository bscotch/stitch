/**
 * @file The macOS platform layer.
 *
 * Based on the unpacked 2026.100.0.1199 `.pkg`, the 1133 runtime module
 * zips, and disassembled IDE code, and partly tested on a real Mac
 * (macOS 27, arm64) in November 2026 (see NOTES.md). Facts that haven't
 * been confirmed on a Mac yet are marked `TODO(verify)`.
 */
import { chmod, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../errors.ts';
import { execFile } from '../exec.ts';
import { exists } from '../fsUtil.ts';
import { findEntries, killPosixProcess, parsePsOutput } from './posix.ts';
import type { IdeLayout, PlatformLayer } from './types.ts';

const p = path.posix;

/**
 * App bundle names: `GameMaker.app` (Monthly), `GameMaker Beta.app`
 * (Beta and Unstable), `GameMaker LTS.app` (LTS2022) and
 * `GameMaker LTS 2026.app` (LTS2026).
 * TODO(verify): [package] these names, and that LTS2026's program_dir_name
 * on Mac really is `GameMakerStudio2-LTS2026`.
 */
const appPattern = /^GameMaker((?: [A-Za-z0-9]+)*)\.app$/;

/** The Apple Developer Team ID that YoYo Games signs its pkgs and apps with */
export const yoyoGamesTeamId = 'C9E7J7HL3D';

export interface PkgSignature {
  /** Whether `pkgutil` says it's signed with an Apple-issued certificate */
  signed: boolean;
  notarized: boolean;
  /** The leaf certificate, e.g. "Developer ID Installer: YoYo Games Ltd (C9E7J7HL3D)" */
  signer?: string;
  teamId?: string;
}

/** Parse the output of `pkgutil --check-signature <pkg>` */
export function parsePkgSignature(output: string): PkgSignature {
  const status = output.match(/^\s*Status:\s*(.+)$/m)?.[1] ?? '';
  const signer = output.match(/^\s*1\.\s*(.+?)\s*$/m)?.[1];
  return {
    signed: /^signed by a (developer )?certificate issued by Apple/i.test(
      status,
    ),
    notarized: /^\s*Notarization:\s*trusted by the Apple notary service/im.test(
      output,
    ),
    signer,
    teamId: signer?.match(/\(([A-Z0-9]{10})\)$/)?.[1],
  };
}

function macArchDir(arch: string) {
  return arch === 'arm64' ? 'arm64' : 'x86_64';
}

export const mac: PlatformLayer = {
  os: 'mac',
  feedPlatform: 'mac',
  pathDelimiter: ':',
  path: p,

  specialFolders(env) {
    return {
      // TODO(verify): [IL] CommonApplicationData is hardcoded to /Users/Shared.
      commonApplicationData: '/Users/Shared',
      // TODO(verify): [IL] .NET 8's ApplicationData. Older IDEs may have used
      // ~/.config, which newer IDEs migrate from.
      applicationData: p.join(env.homedir, 'Library', 'Application Support'),
    };
  },

  defaultIgorCacheDir(env) {
    return p.join(env.homedir, 'Library', 'Caches', 'stitch', 'igor');
  },

  defaultDownloadsDir(env) {
    return Promise.resolve(p.join(env.homedir, 'Downloads'));
  },

  igorCandidates(runtimeDir, arch) {
    // TODO(verify): [package] Igor locations in the runtime's osx module.
    const dir = p.join(runtimeDir, 'bin', 'igor', 'osx');
    return arch === 'arm64'
      ? [p.join(dir, 'arm64', 'Igor'), p.join(dir, 'x64', 'Igor')]
      : [p.join(dir, 'x64', 'Igor')];
  },

  async resolveIdeLayout(ideDir, arch): Promise<IdeLayout | undefined> {
    let entries: string[];
    try {
      entries = await readdir(ideDir);
    } catch {
      return;
    }
    const app = entries.find((e) => appPattern.test(e));
    if (!app) return;
    const suffix = app.match(appPattern)![1].replace(/ /g, '');
    const macOsDir = p.join(ideDir, app, 'Contents', 'MacOS');
    const archDir = p.join(macOsDir, macArchDir(arch));
    return {
      programDirName: `GameMakerStudio2${suffix ? `-${suffix}` : ''}`,
      // A universal launcher that spawns `<arch>/GameMaker` as a child.
      // TODO(verify): whether running it with a project path opens the
      // project, or whether `open -a <app> <project>` is needed.
      executable: p.join(macOsDir, 'GameMaker'),
      cwd: macOsDir,
      matchingRuntime: p.join(archDir, 'matching.runtime'),
      helpKeywords: p.join(archDir, 'RoboHelp', 'helpdocs_keywords.json'),
    };
  },

  async extractInstaller(installer, destDir) {
    // `pkgutil --expand-full` unpacks the pkg and its Payload without
    // installing anything or running its scripts, and needs no root. Unlike
    // 7-Zip, it applies the payload's extended attributes, which hold the
    // code signatures of the non-Mach-O files in `Contents/MacOS`. 7-Zip
    // writes them out as `._*` files instead, which breaks the app's
    // signature. See NOTES.md.
    const work = p.join(destDir, '.expand'); // pkgutil requires a new dir
    const result = await execFile(
      'pkgutil',
      ['--expand-full', installer, work],
      { timeoutMs: 15 * 60_000 },
    );
    if (result.code !== 0) {
      throw new Error(
        `pkgutil exited with code ${result.code}: ${result.stderr || result.stdout}`,
      );
    }
    // Layout: <work>/<component>.pkg/Payload/GameMaker <Channel>.app
    const app = (
      await findEntries(work, (n, isDir) => isDir && appPattern.test(n), 3)
    )[0];
    if (!app) throw new Error('No GameMaker .app found in the pkg payload');
    await rename(app, p.join(destDir, p.basename(app)));
    await rm(work, { recursive: true, force: true });
  },

  async verifyInstaller(installer) {
    const result = await execFile('pkgutil', ['--check-signature', installer], {
      timeoutMs: 60_000,
    });
    const sig = parsePkgSignature(result.stdout);
    if (result.code !== 0 || !sig.signed || sig.teamId !== yoyoGamesTeamId) {
      throw new LauncherError(
        'INSTALLER_INVALID',
        `The GameMaker installer at "${installer}" does not have a valid YoYo Games signature (signer: ${sig.signer || 'none'}).`,
        { installerPath: installer },
        { fix: 'Delete the file so that it can be downloaded again.' },
      );
    }
  },

  async ensureSystemDir(dir) {
    // The pkg's postinstall makes the system dir and its runtime cache
    // world-writable, so do the same.
    // TODO(verify): [package] from the pkg's postinstall script.
    const created = !(await exists(dir));
    const runtimes = p.join(dir, 'Cache', 'runtimes');
    await mkdir(runtimes, { recursive: true });
    if (created) {
      for (const d of [dir, p.join(dir, 'Cache'), runtimes]) {
        await chmod(d, 0o777).catch(() => undefined);
      }
    }
    return { created };
  },

  async listProcesses(executable) {
    // The launcher spawns `<arch>/GameMaker` as a child process, so match
    // anything running from the app's MacOS dir.
    // TODO(verify): process names and paths on a real Mac.
    const result = await execFile('ps', ['-axo', 'pid=,comm=']);
    const prefix = `${p.dirname(executable)}/`;
    return parsePsOutput(result.stdout).filter((proc) =>
      proc.executable.startsWith(prefix),
    );
  },

  killProcess: killPosixProcess,
};
