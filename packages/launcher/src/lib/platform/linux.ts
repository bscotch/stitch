/**
 * @file The Linux platform layer.
 *
 * Tested on Ubuntu 24.04 (x64) with Beta 2026.100.0.1199; see "Linux
 * layout" in NOTES.md. arm64 is untested, and marked `TODO(verify)`. Only
 * Beta/Unstable and LTS2026 have Linux releases.
 */
import { mkdir, readdir, readlink } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from '../exec.ts';
import { exists } from '../fsUtil.ts';
import { unpackDeb } from './deb.ts';
import { killPosixProcess } from './posix.ts';
import type { IdeLayout, PlatformLayer, RunningProcess } from './types.ts';

const p = path.posix;

/** Package dirs under /opt: `GameMaker-Beta`, `GameMaker-LTS2026` */
const pkgPattern = /^GameMaker(-[A-Za-z0-9]+)?$/;

/** `opt/<pkg>/…` in a deb's data, captured as `<pkg>/…` */
const optPkgPathPattern = /^opt\/(GameMaker(?:-[A-Za-z0-9]+)?(?:\/.*)?)$/;

function linuxArchDir(arch: string) {
  return arch === 'arm64' ? 'aarch64' : 'x86_64';
}

export const linux: PlatformLayer = {
  os: 'linux',
  feedPlatform: 'linux',
  // Debs are unpacked natively (see deb.ts), so no 7-Zip is needed.
  pathDelimiter: ':',
  path: p,

  specialFolders(env) {
    const home = env.homedir;
    return {
      // The IDE sets CommonApplicationData to LocalApplicationData, i.e.
      // $XDG_DATA_HOME or ~/.local/share.
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
    // x64 is observed; TODO(verify): the arm64 location.
    const dir = p.join(runtimeDir, 'bin', 'igor', 'linux');
    return [p.join(dir, arch === 'arm64' ? 'arm64' : 'x64', 'Igor')];
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
      // spaces and relative paths. Run the real binary directly instead
      // (the wrapper only adds crash-dump settings).
      executable: p.join(archDir, 'GameMaker'),
      cwd: archDir,
      matchingRuntime: p.join(archDir, 'matching.runtime'),
      helpKeywords: p.join(archDir, 'RoboHelp', 'helpdocs_keywords.json'),
    };
  },

  async unpackInstaller(installer, destDir) {
    // Only `opt/<pkg>/` matters: the deb's other files are a .desktop
    // entry, MIME types and docs. File modes come from the deb.
    await unpackDeb(
      installer,
      destDir,
      (entry) => entry.match(optPkgPathPattern)?.[1],
    );
    const pkgs = (await readdir(destDir)).filter((n) => pkgPattern.test(n));
    if (pkgs.length !== 1) {
      throw new Error(
        `Expected one /opt/GameMaker* dir in the deb, found ${pkgs.length}`,
      );
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
