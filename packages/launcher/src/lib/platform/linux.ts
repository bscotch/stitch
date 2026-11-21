/**
 * @file The Linux platform layer.
 *
 * Nothing here has been tested on a real Linux machine. It's based on the
 * unpacked 2026.100.0.1199 and LTS2026 2026.1.0.27 `.deb`s, the 1133
 * runtime module zips, and disassembled IDE code (see NOTES.md). Every such
 * fact is marked `TODO(verify)`. Only Beta/Unstable and LTS2026 have Linux
 * releases.
 */
import { chmod, mkdir, readdir, readlink, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from '../exec.ts';
import { exists } from '../fsUtil.ts';
import {
  extractNested,
  findEntries,
  killPosixProcess,
  sevenZipExtract,
} from './posix.ts';
import type { IdeLayout, PlatformLayer, RunningProcess } from './types.ts';

const p = path.posix;

/** Package dirs under /opt: `GameMaker-Beta`, `GameMaker-LTS2026` */
const pkgPattern = /^GameMaker(-[A-Za-z0-9]+)?$/;

function linuxArchDir(arch: string) {
  return arch === 'arm64' ? 'aarch64' : 'x86_64';
}

export const linux: PlatformLayer = {
  os: 'linux',
  feedPlatform: 'linux',
  sevenZipFormat: 'Ar',
  // TODO(verify): [unverified] package names (`p7zip-full` on older distros).
  sevenZipInstallCommand: 'sudo apt install 7zip',
  sevenZipNames: ['7zz', '7z'],
  pathDelimiter: ':',
  path: p,

  specialFolders(env) {
    const home = env.homedir;
    return {
      // TODO(verify): [IL] the IDE sets CommonApplicationData to
      // LocalApplicationData, i.e. $XDG_DATA_HOME or ~/.local/share.
      commonApplicationData:
        env.env.XDG_DATA_HOME || p.join(home, '.local', 'share'),
      applicationData: env.env.XDG_CONFIG_HOME || p.join(home, '.config'),
    };
  },

  defaultIgorCacheDir(env) {
    const cache = env.env.XDG_CACHE_HOME || p.join(env.homedir, '.cache');
    return p.join(cache, 'stitch', 'igor');
  },

  async defaultDownloadsDir(env) {
    try {
      const result = await execFile('xdg-user-dir', ['DOWNLOAD'], {
        timeoutMs: 5_000,
      });
      const dir = result.stdout.trim();
      // xdg-user-dir prints $HOME when the dir isn't configured
      if (
        result.code === 0 &&
        dir &&
        p.resolve(dir) !== p.resolve(env.homedir)
      ) {
        return dir;
      }
    } catch {
      // Not installed
    }
    return p.join(env.homedir, 'Downloads');
  },

  igorCandidates(runtimeDir, arch) {
    // TODO(verify): [package] Igor locations in the runtime's linux module.
    const dir = p.join(runtimeDir, 'bin', 'igor', 'linux');
    return [p.join(dir, arch === 'arm64' ? 'arm64' : 'x64', 'Igor')];
  },

  sevenZipCandidates() {
    return Promise.resolve([
      '/usr/bin/7zz',
      '/usr/local/bin/7zz',
      '/usr/bin/7z',
    ]);
  },

  async resolveIdeLayout(ideDir, arch): Promise<IdeLayout | undefined> {
    let entries: string[];
    try {
      entries = await readdir(ideDir);
    } catch {
      return;
    }
    const pkg = entries.find((e) => pkgPattern.test(e));
    if (!pkg) return;
    const suffix = pkg.match(pkgPattern)![1] || '';
    const archDir = p.join(ideDir, pkg, linuxArchDir(arch));
    return {
      programDirName: `GameMakerStudio2${suffix}`,
      // `/opt/<pkg>/GameMaker` is a bash wrapper that `cd`s into the arch
      // dir and passes its arguments unquoted, which breaks paths with
      // spaces and relative paths. Run the real binary directly instead.
      // TODO(verify): [package] that this works the same as the wrapper.
      executable: p.join(archDir, 'GameMaker'),
      cwd: archDir,
      matchingRuntime: p.join(archDir, 'matching.runtime'),
      // TODO(verify): help keywords location.
      helpKeywords: p.join(archDir, 'RoboHelp', 'helpdocs_keywords.json'),
    };
  },

  async extractInstaller(sevenZip, installer, destDir) {
    // deb (ar) → data.tar.* → data.tar → opt/<pkg>/
    // TODO(verify): that the result runs, including exec bits, symlinks,
    // and data.tar compression (xz vs zstd) support in the user's 7-Zip.
    const work = p.join(destDir, '.extract');
    const ar = p.join(work, 'ar');
    await mkdir(ar, { recursive: true });
    await sevenZipExtract(sevenZip, installer, ar, 'Ar');
    const dataTar = (await readdir(ar)).find((n) => n.startsWith('data.tar'));
    if (!dataTar) throw new Error('No data.tar found in the deb');
    const root = await extractNested(
      sevenZip,
      p.join(ar, dataTar),
      p.join(work, 'data'),
    );
    const optDir = p.join(root, 'opt');
    const pkg = (await readdir(optDir)).find((n) => pkgPattern.test(n));
    if (!pkg) throw new Error('No /opt/GameMaker* dir found in the deb');
    await rename(p.join(optDir, pkg), p.join(destDir, pkg));
    await rm(work, { recursive: true, force: true });
    for (const exe of await findEntries(
      p.join(destDir, pkg),
      (n, isDir) => !isDir && n === 'GameMaker',
      1,
    )) {
      await chmod(exe, 0o755).catch(() => undefined);
    }
  },

  async verifyInstaller() {
    // Debs from GameMaker aren't individually signed. Downloads are over
    // HTTPS from GameMaker's own host.
  },

  async ensureSystemDir(dir) {
    // The system dir is under the user's home, so no sharing is needed.
    const created = !(await exists(dir));
    await mkdir(dir, { recursive: true });
    return { created };
  },

  async listProcesses(executable) {
    const processes: RunningProcess[] = [];
    let pids: string[];
    try {
      pids = (await readdir('/proc')).filter((n) => /^\d+$/.test(n));
    } catch {
      return [];
    }
    const target = p.resolve(executable);
    await Promise.all(
      pids.map(async (pid) => {
        try {
          const exe = await readlink(`/proc/${pid}/exe`);
          if (exe === target)
            processes.push({ pid: Number(pid), executable: exe });
        } catch {
          // Gone, or not ours
        }
      }),
    );
    return processes;
  },

  killProcess: killPosixProcess,
};
