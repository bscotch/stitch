import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { put, testOptions, tmpDir } from '../test/helpers.ts';
import { resolveOptions } from './options.ts';
import { computeGameMakerDirs } from './paths.ts';
import {
  findRuntime,
  listInstalledRuntimes,
  parseRuntimeConfig,
  parseRuntimeReceipt,
} from './runtimes.ts';
import {
  findActiveUserDir,
  loggedOutUserDirName,
  userDirNameFromUserInfo,
} from './user.ts';

const receipt = {
  base: {
    Name: 'base',
    Uri: 'https://example.com/a.zip',
    Version: '2026.100.0.1133',
  },
  windows: {
    Name: 'windows',
    Uri: 'https://example.com/b.zip',
    Version: '2026.100.0.1133',
  },
  windowsYYC: { Name: 'windowsYYC', Version: '2026.100.0.1133' },
};

async function fakeRuntime(
  runtimesDir: string,
  version: string,
  opts: { igor?: boolean; receipt?: boolean } = {},
) {
  const dir = path.join(runtimesDir, `runtime-${version}`);
  if (opts.igor ?? true)
    await put(
      path.join(dir, 'bin', 'igor', 'windows', 'x64', 'Igor.exe'),
      'exe',
    );
  if (opts.receipt ?? true) await put(path.join(dir, 'receipt.json'), receipt);
  return dir;
}

describe('Runtime files', function () {
  it('parses receipt.json modules', function () {
    assert.deepEqual(parseRuntimeReceipt(receipt), [
      { name: 'base', version: '2026.100.0.1133' },
      { name: 'windows', version: '2026.100.0.1133' },
      { name: 'windowsYYC', version: '2026.100.0.1133' },
    ]);
    assert.deepEqual(parseRuntimeReceipt(null), []);
  });

  it('parses runtime.json, including entries without a feed (written by old Stitch)', function () {
    const config = parseRuntimeConfig({
      active: '2026.100.0.1133',
      '2024.1400.3.933':
        'c:\\ProgramData\\GameMakerStudio2-Beta\\Cache\\runtimes\\runtime-2024.1400.3.933&',
      '2026.100.0.1133':
        'C:\\ProgramData/GameMakerStudio2-Beta/Cache/runtimes\\runtime-2026.100.0.1133&https://gms.yoyogames.com/Zeus-Runtime-NuBeta.rss',
      '2023.1.1.1': 'C:\\old\\runtime-2023.1.1.1',
    });
    assert.equal(config.active, '2026.100.0.1133');
    assert.deepEqual(config.runtimes['2026.100.0.1133'], {
      directory:
        'C:\\ProgramData/GameMakerStudio2-Beta/Cache/runtimes\\runtime-2026.100.0.1133',
      feedUrl: 'https://gms.yoyogames.com/Zeus-Runtime-NuBeta.rss',
    });
    assert.equal(config.runtimes['2024.1400.3.933'].feedUrl, undefined);
    assert.deepEqual(config.runtimes['2023.1.1.1'], {
      directory: 'C:\\old\\runtime-2023.1.1.1',
      feedUrl: undefined,
    });
  });
});

describe('Installed runtimes', function () {
  it('lists complete runtimes across channels, skipping incomplete ones', async function () {
    const root = await tmpDir();
    const options = { ...testOptions(root, undefined), os: 'windows' as const };
    const resolved = resolveOptions(options);
    const beta = computeGameMakerDirs('GameMakerStudio2-Beta', resolved);
    const lts = computeGameMakerDirs('GameMakerStudio2-LTS2026', resolved);
    await fakeRuntime(beta.runtimes, '2026.100.0.1133');
    await fakeRuntime(beta.runtimes, '2024.1400.3.933');
    await fakeRuntime(beta.runtimes, '2026.100.0.1199', { igor: false }); // download in progress
    await fakeRuntime(beta.runtimes, '2026.100.0.1200', { receipt: false });
    await put(
      path.join(beta.runtimes, 'runtime-not-a-version', 'receipt.json'),
      {},
    );
    await fakeRuntime(lts.runtimes, '2026.1.0.28');
    await put(beta.runtimeConfig, { active: '2026.100.0.1133' });

    const runtimes = await listInstalledRuntimes(options);
    assert.deepEqual(
      runtimes.map((r) => [r.version, r.programDirName, r.isActive]),
      [
        ['2026.100.0.1133', 'GameMakerStudio2-Beta', true],
        ['2026.1.0.28', 'GameMakerStudio2-LTS2026', false],
        ['2024.1400.3.933', 'GameMakerStudio2-Beta', false],
      ],
    );
    assert.deepEqual(
      runtimes[0].modules.map((m) => m.name),
      ['base', 'windows', 'windowsYYC'],
    );
    assert.match(
      runtimes[0].igorPath,
      /bin[\\/]igor[\\/]windows[\\/]x64[\\/]Igor\.exe$/,
    );

    const found = await findRuntime('2026.1.0.28', options);
    assert.equal(found?.programDirName, 'GameMakerStudio2-LTS2026');
    assert.equal(await findRuntime('2026.100.0.1199', options), undefined);
  });

  it('prefers the requested channel for duplicate versions', async function () {
    const root = await tmpDir();
    const options = { ...testOptions(root, undefined), os: 'windows' as const };
    const resolved = resolveOptions(options);
    for (const pdn of ['GameMakerStudio2-LTS2026', 'GameMakerStudio2-Beta']) {
      await fakeRuntime(
        computeGameMakerDirs(pdn, resolved).runtimes,
        '2026.0.0.10',
      );
    }
    assert.equal(
      (await findRuntime('2026.0.0.10', options))?.programDirName,
      'GameMakerStudio2-LTS2026',
    );
    assert.equal(
      (
        await findRuntime('2026.0.0.10', {
          ...options,
          programDirName: 'GameMakerStudio2-Beta',
        })
      )?.programDirName,
      'GameMakerStudio2-Beta',
    );
  });
});

describe('GameMaker user dirs', function () {
  it('builds the user dir name from the login and user ID', function () {
    assert.equal(
      userDirNameFromUserInfo({
        login: 'someone@example.com',
        userID: '123456',
        accessToken: 'x',
      }),
      'someone_123456',
    );
    assert.equal(
      userDirNameFromUserInfo({ login: 'someone@example.com', userID: 42 }),
      'someone_42',
    );
  });

  it('treats missing fields as logged out', function () {
    // Logged-out um.json files only have obfuscated keys
    assert.equal(
      userDirNameFromUserInfo({ deviceID: 'abc', rocinante: 'x' }),
      undefined,
    );
    assert.equal(
      userDirNameFromUserInfo({ login: '', userID: '1' }),
      undefined,
    );
    assert.equal(userDirNameFromUserInfo(undefined), undefined);
  });

  it('finds the active user dir, or falls back to the logged-out one', async function () {
    const root = await tmpDir();
    const userRoot = path.join(root, 'GameMakerStudio2-Beta');
    let active = await findActiveUserDir(userRoot, path.join);
    assert.deepEqual(active, {
      dir: path.join(userRoot, loggedOutUserDirName),
      loggedIn: false,
    });
    await put(path.join(userRoot, 'um.json'), {
      login: 'me@example.com',
      userID: '7',
    });
    active = await findActiveUserDir(userRoot, path.join);
    assert.deepEqual(active, {
      dir: path.join(userRoot, 'me_7'),
      loggedIn: true,
    });
  });
});
