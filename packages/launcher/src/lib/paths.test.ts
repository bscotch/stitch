import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveOptions } from './options.ts';
import {
  channelForProgramDirName,
  channelsForProgramDirName,
  computeGameMakerDirs,
  knownProgramDirNames,
  programDirNameForChannel,
} from './paths.ts';
import type { OsName, PlatformEnv } from './platform/types.ts';

const winEnv: PlatformEnv = {
  homedir: 'C:\\Users\\me',
  env: {
    PROGRAMDATA: 'C:\\ProgramData',
    APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
  },
  arch: 'x64',
};
const macEnv: PlatformEnv = { homedir: '/Users/me', env: {}, arch: 'arm64' };
const linuxEnv: PlatformEnv = { homedir: '/home/me', env: {}, arch: 'x64' };

const opts = (os: OsName, platformEnv: PlatformEnv, extra = {}) =>
  resolveOptions({ os, platformEnv, ...extra });

describe('Channels and program_dir_names', function () {
  it('maps channels to program_dir_names', function () {
    assert.equal(programDirNameForChannel('monthly'), 'GameMakerStudio2');
    assert.equal(programDirNameForChannel('beta'), 'GameMakerStudio2-Beta');
    assert.equal(programDirNameForChannel('unstable'), 'GameMakerStudio2-Beta');
    assert.equal(programDirNameForChannel('lts2022'), 'GameMakerStudio2-LTS');
    assert.equal(
      programDirNameForChannel('lts2026'),
      'GameMakerStudio2-LTS2026',
    );
    assert.equal(programDirNameForChannel('nope'), undefined);
  });

  it('maps program_dir_names back to the most stable channel', function () {
    assert.equal(channelForProgramDirName('GameMakerStudio2-Beta'), 'beta');
    assert.deepEqual(channelsForProgramDirName('GameMakerStudio2-Beta'), [
      'beta',
      'unstable',
    ]);
    assert.equal(channelForProgramDirName('GameMakerStudio2'), 'monthly');
    assert.equal(channelForProgramDirName('Nope'), undefined);
  });

  it('lists each program_dir_name once', function () {
    assert.deepEqual(knownProgramDirNames(), [
      'GameMakerStudio2-LTS2026',
      'GameMakerStudio2-LTS',
      'GameMakerStudio2',
      'GameMakerStudio2-Beta',
    ]);
  });
});

describe('GameMaker dirs', function () {
  it('computes Windows dirs', function () {
    const dirs = computeGameMakerDirs(
      'GameMakerStudio2-Beta',
      opts('windows', winEnv),
    );
    assert.equal(dirs.system, 'C:\\ProgramData\\GameMakerStudio2-Beta');
    assert.equal(
      dirs.user,
      'C:\\Users\\me\\AppData\\Roaming\\GameMakerStudio2-Beta',
    );
    assert.equal(
      dirs.runtimes,
      'C:\\ProgramData\\GameMakerStudio2-Beta\\Cache\\runtimes',
    );
    assert.equal(dirs.ideLog, 'C:\\ProgramData\\GameMakerStudio2-Beta\\ui.log');
    assert.equal(
      dirs.defaultMacros,
      'C:\\ProgramData\\GameMakerStudio2-Beta\\default_macros.json',
    );
    assert.equal(
      dirs.userInfo,
      'C:\\Users\\me\\AppData\\Roaming\\GameMakerStudio2-Beta\\um.json',
    );
  });

  it('falls back to defaults when Windows env vars are missing', function () {
    const dirs = computeGameMakerDirs(
      'GameMakerStudio2',
      opts('windows', { ...winEnv, env: {} }),
    );
    assert.equal(dirs.system, 'C:\\ProgramData\\GameMakerStudio2');
    assert.equal(
      dirs.user,
      'C:\\Users\\me\\AppData\\Roaming\\GameMakerStudio2',
    );
  });

  it('computes macOS dirs', function () {
    const dirs = computeGameMakerDirs(
      'GameMakerStudio2-Beta',
      opts('mac', macEnv),
    );
    assert.equal(dirs.system, '/Users/Shared/GameMakerStudio2-Beta');
    assert.equal(
      dirs.user,
      '/Users/me/Library/Application Support/GameMakerStudio2-Beta',
    );
    assert.equal(
      dirs.runtimes,
      '/Users/Shared/GameMakerStudio2-Beta/Cache/runtimes',
    );
  });

  it('computes Linux dirs, with and without XDG vars', function () {
    let dirs = computeGameMakerDirs(
      'GameMakerStudio2-LTS2026',
      opts('linux', linuxEnv),
    );
    assert.equal(dirs.system, '/home/me/.local/share/GameMakerStudio2-LTS2026');
    assert.equal(dirs.user, '/home/me/.config/GameMakerStudio2-LTS2026');
    dirs = computeGameMakerDirs(
      'GameMakerStudio2-LTS2026',
      opts('linux', {
        ...linuxEnv,
        env: { XDG_DATA_HOME: '/data', XDG_CONFIG_HOME: '/config' },
      }),
    );
    assert.equal(dirs.system, '/data/GameMakerStudio2-LTS2026');
    assert.equal(dirs.user, '/config/GameMakerStudio2-LTS2026');
  });

  it('applies overrides', function () {
    const dirs = computeGameMakerDirs(
      'GameMakerStudio2-Beta',
      opts('windows', winEnv, {
        gameMakerDirs: { 'GameMakerStudio2-Beta': { system: 'D:\\GM' } },
      }),
    );
    assert.equal(dirs.system, 'D:\\GM');
    assert.equal(dirs.runtimes, 'D:\\GM\\Cache\\runtimes');
    assert.equal(
      dirs.user,
      'C:\\Users\\me\\AppData\\Roaming\\GameMakerStudio2-Beta',
    );
  });
});

describe("Stitch's default dirs", function () {
  it('computes defaults per OS', function () {
    const win = opts('windows', winEnv);
    assert.equal(win.ideCacheDir, 'C:\\Users\\me\\.stitch\\launcher\\ide');
    assert.equal(win.stateDir, 'C:\\Users\\me\\.stitch\\launcher');
    assert.equal(
      win.igorCacheDir,
      'C:\\Users\\me\\AppData\\Local\\stitch\\igor',
    );
    assert.equal(
      opts('mac', macEnv).igorCacheDir,
      '/Users/me/Library/Caches/stitch/igor',
    );
    assert.equal(
      opts('linux', linuxEnv).igorCacheDir,
      '/home/me/.cache/stitch/igor',
    );
    assert.equal(
      opts('linux', { ...linuxEnv, env: { XDG_CACHE_HOME: '/c' } })
        .igorCacheDir,
      '/c/stitch/igor',
    );
  });

  it('uses overrides, treating empty strings as unset', async function () {
    const resolved = opts('mac', macEnv, {
      ideCacheDir: '/big/disk',
      downloadsDir: '',
      sevenZipPath: '  ',
    });
    assert.equal(resolved.ideCacheDir, '/big/disk');
    assert.equal(resolved.sevenZipPath, undefined);
    assert.equal(await resolved.downloadsDir(), '/Users/me/Downloads');
    const custom = opts('mac', macEnv, { downloadsDir: '/dl' });
    assert.equal(await custom.downloadsDir(), '/dl');
  });

  it('passes already-resolved options through', function () {
    const resolved = opts('linux', linuxEnv);
    assert.equal(resolveOptions(resolved), resolved);
  });
});
