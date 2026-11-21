import assert from 'node:assert/strict';
import { mkdir, readdir, utimes } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  fakeCachedIde,
  fixtureFeed,
  put,
  testOptions,
  tmpDir,
} from '../test/helpers.ts';
import { isLauncherError } from './errors.ts';
import {
  findIde,
  getIdeCacheInfo,
  listAvailableIdes,
  pruneIdeCache,
} from './ideCache.ts';
import type { OsName } from './platform/types.ts';

async function setup(os: OsName) {
  const root = await tmpDir();
  const options = { ...testOptions(root, await fixtureFeed()), os };
  const cache = options.ideCacheDir!;
  await fakeCachedIde(cache, '2026.100.0.1199', {
    os,
    suffix: '-Beta',
    matchingRuntime: '2026.100.0.1133',
  });
  await fakeCachedIde(cache, '2026.1.0.27', {
    os,
    suffix: '-LTS2026',
    matchingRuntime: '2026.1.0.28',
  });
  // Not downloadable anymore (not in the feed)
  await fakeCachedIde(cache, '2023.400.0.324', { os, suffix: '-Beta' });
  return { root, options, cache };
}

describe('IDE cache', function () {
  for (const os of ['windows', 'mac', 'linux'] as const) {
    it(`lists cached IDEs (${os} layout)`, async function () {
      const { options } = await setup(os);
      const ides = await listAvailableIdes(options);
      assert.deepEqual(
        ides.map((i) => [
          i.version,
          i.channel,
          i.programDirName,
          i.pairedRuntimeVersion,
          i.installable,
        ]),
        [
          [
            '2026.100.0.1199',
            'beta',
            'GameMakerStudio2-Beta',
            '2026.100.0.1133',
            true,
          ],
          [
            '2026.1.0.27',
            'lts2026',
            'GameMakerStudio2-LTS2026',
            '2026.1.0.28',
            true,
          ],
          ['2023.400.0.324', 'beta', 'GameMakerStudio2-Beta', undefined, false],
        ],
      );
      assert.deepEqual(ides[0].channels, ['beta', 'unstable']);
      assert.deepEqual(ides[2].channels, ['beta', 'unstable']);
    });
  }

  it('reads caches made by old Stitch versions (copied installs)', async function () {
    const root = await tmpDir();
    const options = {
      ...testOptions(root, await fixtureFeed()),
      os: 'windows' as const,
    };
    const dir = path.join(options.ideCacheDir!, 'gamemaker-2024.1400.0.904');
    await put(path.join(dir, 'GameMaker-Beta.exe'));
    await put(path.join(dir, 'uninstall.exe'));
    await put(path.join(dir, 'GameMakerProjectTool.exe'));
    await put(path.join(dir, 'matching.runtime'), '2024.1400.0.892 ');
    const ide = await findIde('2024.1400.0.904', options);
    assert.equal(ide?.executable, path.join(dir, 'GameMaker-Beta.exe'));
    assert.equal(ide?.pairedRuntimeVersion, '2024.1400.0.892');
    assert.equal(
      ide?.helpKeywordsFile,
      path.join(dir, 'RoboHelp', 'helpdocs_keywords.json'),
    );
  });

  it('ignores partial extractions and unrelated entries', async function () {
    const { options, cache } = await setup('windows');
    await fakeCachedIde(cache, '2026.100.0.1207', {
      os: 'windows',
      suffix: '-Beta',
    });
    const { rename } = await import('node:fs/promises');
    await rename(
      path.join(cache, 'gamemaker-2026.100.0.1207'),
      path.join(cache, '.tmp-2026.100.0.1207-abc'),
    );
    await mkdir(path.join(cache, 'gamemaker-2026.100.0.1208')); // empty
    await put(path.join(cache, 'notes.txt'));
    assert.equal((await listAvailableIdes(options)).length, 3);
    assert.equal(await findIde('2026.100.0.1208', options), undefined);
  });

  it('works without a feed', async function () {
    const { options } = await setup('windows');
    const ides = await listAvailableIdes({
      ...options,
      feed: undefined,
      feedUrl: 'http://127.0.0.1:1/x.json',
    });
    assert.equal(ides.length, 3);
    assert.ok(ides.every((i) => !i.installable && !i.inFeed));
    assert.equal(ides[1].channel, 'lts2026');
  });

  it('reports sizes', async function () {
    const { options } = await setup('windows');
    const info = await getIdeCacheInfo(options);
    assert.ok(info.every((i) => i.sizeBytes > 0));
  });

  it('prunes by version and by predicate', async function () {
    const { options, cache } = await setup('windows');
    const removed = await pruneIdeCache(['2026.1.0.27'], options);
    assert.deepEqual(removed, [path.join(cache, 'gamemaker-2026.1.0.27')]);
    await pruneIdeCache(
      (ide) => ide.channel === 'beta' && ide.installable,
      options,
    );
    assert.deepEqual(await readdir(cache), ['gamemaker-2023.400.0.324']);
  });

  it('requires confirmation to prune versions that are no longer downloadable', async function () {
    const { options, cache } = await setup('windows');
    await assert.rejects(
      pruneIdeCache(() => true, options),
      (err) => {
        assert.ok(isLauncherError(err, 'PRUNE_REQUIRES_CONFIRMATION'));
        assert.deepEqual(err.data.notInstallable, ['2023.400.0.324']);
        return true;
      },
    );
    assert.equal((await readdir(cache)).length, 3, 'Nothing should be deleted');
    await pruneIdeCache(() => true, {
      ...options,
      includeNotInstallable: true,
    });
    assert.deepEqual(await readdir(cache), []);
  });

  it('removes leftovers from old launcher versions and abandoned extractions', async function () {
    const { options, cache } = await setup('windows');
    await put(path.join(cache, 'gamemaker-2022.9.1.66.exe'), 'old installer');
    const abandoned = path.join(cache, '.tmp-2026.100.0.1207-old');
    const fresh = path.join(cache, '.tmp-2026.100.0.1207-new');
    await mkdir(abandoned);
    await mkdir(fresh);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(abandoned, twoDaysAgo, twoDaysAgo);
    const removed = await pruneIdeCache([], options);
    assert.deepEqual(
      removed.sort(),
      [abandoned, path.join(cache, 'gamemaker-2022.9.1.66.exe')].sort(),
    );
    assert.ok((await readdir(cache)).includes('.tmp-2026.100.0.1207-new'));
  });
});
