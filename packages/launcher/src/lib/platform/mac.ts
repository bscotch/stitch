/**
 * @file The macOS platform layer.
 *
 * Nothing here has been tested on a real Mac. It's based on the unpacked
 * 2026.100.0.1199 `.pkg`, the 1133 runtime module zips, and disassembled IDE
 * code (see NOTES.md). Every such fact is marked `TODO(verify)`.
 */
import { chmod, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from '../exec.ts';
import { exists } from '../fsUtil.ts';
import {
  extractNested,
  findEntries,
  killPosixProcess,
  parsePsOutput,
  sevenZipExtract,
} from './posix.ts';
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

function macArchDir(arch: string) {
  return arch === 'arm64' ? 'arm64' : 'x86_64';
}

export const mac: PlatformLayer = {
  os: 'mac',
  feedPlatform: 'mac',
  // TODO: pkgs (Xar → gzip → cpio) could be unpacked natively, like debs
  // on Linux, removing the 7-Zip dependency on macOS.
  sevenZip: {
    format: 'Xar',
    // TODO(verify): [unverified] the Homebrew formula name.
    installCommand: 'brew install sevenzip',
    names: ['7zz'],
    candidates() {
      // GUI apps (like VS Code launched from the Dock) may not have
      // Homebrew's bin dir on their PATH.
      return Promise.resolve(['/opt/homebrew/bin/7zz', '/usr/local/bin/7zz']);
    },
  },
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
      // TODO(verify): [package] matching.runtime location.
      matchingRuntime: p.join(archDir, 'matching.runtime'),
      // TODO(verify): help keywords location in the app bundle.
      helpKeywords: p.join(archDir, 'RoboHelp', 'helpdocs_keywords.json'),
    };
  },

  async unpackInstaller(installer, destDir, sevenZip) {
    if (!sevenZip) throw new Error('7-Zip is required to unpack installers');
    // TODO(verify): extracting the pkg (Xar → Payload → cpio) produces a
    // runnable app: permissions, symlinks, Gatekeeper and quarantine.
    // The pkg only installs to /Applications, so extracting is the only way
    // to get a cached copy without touching the user's own install.
    const work = p.join(destDir, '.extract');
    await sevenZipExtract(sevenZip, installer, p.join(work, 'xar'), 'Xar');
    const payloads = await findEntries(
      p.join(work, 'xar'),
      (name, isDir) => name === 'Payload' && !isDir,
      3,
    );
    if (!payloads.length) throw new Error('No Payload found in the pkg');
    let app: string | undefined;
    for (const [i, payload] of payloads.entries()) {
      const root = await extractNested(
        sevenZip,
        payload,
        p.join(work, `p${i}`),
      );
      app = (
        await findEntries(root, (n, isDir) => isDir && appPattern.test(n), 2)
      )[0];
      if (app) break;
    }
    if (!app) throw new Error('No GameMaker .app found in the pkg payload');
    await rename(app, p.join(destDir, p.basename(app)));
    await rm(work, { recursive: true, force: true });
    // TODO(verify): whether exec bits survive the cpio extraction.
    const macOsDir = p.join(destDir, p.basename(app), 'Contents', 'MacOS');
    for (const exe of await findEntries(
      macOsDir,
      (n) => n === 'GameMaker',
      1,
    )) {
      await chmod(exe, 0o755).catch(() => undefined);
    }
  },

  async verifyInstaller() {
    // TODO(verify): check the pkg signature (e.g. `pkgutil --check-signature`
    // for a YoYo Games Developer ID). Skipped until it can be tested.
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
