import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { isLauncherError } from './errors.ts';
import {
  clearFeedMemoryCache,
  getReleasesFeed,
  normalizeVersion,
} from './feed.ts';
import {
  fakeCachedIde,
  fixtureFeed,
  sandboxedOs,
  put,
  testOptions,
  tmpDir,
} from '../test/helpers.ts';
import { getIdeVersionDetails } from './versions.ts';

describe('Version details', function () {
  it('normalizes version strings', function () {
    assert.equal(normalizeVersion('v2024.06.2.162'), '2024.6.2.162');
    assert.equal(normalizeVersion(' 2026.100.0.1199 \n'), '2026.100.0.1199');
    assert.throws(() => normalizeVersion('2024.6.2'));
    assert.throws(() => normalizeVersion('2024.6.2.1abc'));
  });

  it('gets details from the feed for an uncached IDE', async function () {
    const root = await tmpDir();
    const details = await getIdeVersionDetails('2026.100.0.1199', {
      ...testOptions(root, await fixtureFeed()),
      os: 'windows',
    });
    assert.equal(details.channel, 'beta');
    assert.deepEqual(details.channels, ['beta', 'unstable']);
    assert.equal(details.inFeed, true);
    assert.equal(details.installable, true);
    assert.equal(details.runtimeVersion, '2026.100.0.1133');
    assert.equal(details.runtimeVersionSource, 'feed');
    assert.equal(details.dirs.programDirName, 'GameMakerStudio2-Beta');
    assert.equal(details.cached, undefined);
    assert.match(
      details.downloads.windows!,
      /GameMaker-Installer-2026\.100\.0\.1199\.exe$/,
    );
  });

  it('knows which versions are installable on which OS', async function () {
    const root = await tmpDir();
    const feed = await fixtureFeed();
    const installable = async (os: 'windows' | 'mac' | 'linux', v: string) =>
      (await getIdeVersionDetails(v, { ...testOptions(root, feed), os }))
        .installable;
    assert.equal(await installable('windows', '2024.14.4.222'), true);
    assert.equal(await installable('linux', '2024.14.4.222'), false);
    assert.equal(await installable('linux', '2026.100.0.1207'), true);
    assert.equal(await installable('windows', '2026.100.0.1207'), false);
  });

  it('picks the most stable channel', async function () {
    const root = await tmpDir();
    const details = await getIdeVersionDetails(
      '2026.0.0.16',
      testOptions(root, await fixtureFeed()),
    );
    assert.equal(details.channel, 'lts2026');
    assert.equal(details.dirs.programDirName, 'GameMakerStudio2-LTS2026');
  });

  it("prefers an override, then the cached IDE's matching.runtime, then the feed", async function () {
    const root = await tmpDir();
    const os = sandboxedOs();
    const options = { ...testOptions(root, await fixtureFeed()), os };
    await fakeCachedIde(options.ideCacheDir!, '2026.100.0.1199', {
      os,
      suffix: '-Beta',
      matchingRuntime: '2026.100.0.1130',
    });
    let details = await getIdeVersionDetails('2026.100.0.1199', options);
    assert.equal(details.runtimeVersion, '2026.100.0.1130');
    assert.equal(details.runtimeVersionSource, 'matching.runtime');
    assert.ok(details.cached);
    details = await getIdeVersionDetails('2026.100.0.1199', {
      ...options,
      runtimeVersion: '2026.100.0.1100',
    });
    assert.equal(details.runtimeVersion, '2026.100.0.1100');
    assert.equal(details.runtimeVersionSource, 'override');
  });

  it("handles cached IDEs that aren't in the feed", async function () {
    const root = await tmpDir();
    const os = sandboxedOs();
    const options = { ...testOptions(root, await fixtureFeed()), os };
    await fakeCachedIde(options.ideCacheDir!, '2023.400.0.324', {
      os,
      suffix: '-Beta',
      matchingRuntime: '2023.400.0.320',
    });
    const details = await getIdeVersionDetails('2023.400.0.324', options);
    assert.equal(details.inFeed, false);
    assert.equal(details.installable, false);
    assert.equal(details.channel, 'beta');
    assert.equal(details.runtimeVersion, '2023.400.0.320');
    assert.equal(details.cached?.installable, false);
  });

  it('throws for versions that are neither in the feed nor cached', async function () {
    const root = await tmpDir();
    await assert.rejects(
      getIdeVersionDetails(
        '2022.600.0.147',
        testOptions(root, await fixtureFeed()),
      ),
      (err) => isLauncherError(err, 'IDE_NOT_FOUND'),
    );
  });
});

describe('Releases feed loading', function () {
  it('uses a stale cached feed when fetching fails', async function () {
    clearFeedMemoryCache();
    const root = await tmpDir();
    const feed = await fixtureFeed();
    const url = 'http://127.0.0.1:1/releases.json';
    await put(path.join(root, 'state', 'releases.v2.json'), {
      url,
      fetchedAt: 0,
      feed,
    });
    const loaded = await getReleasesFeed({
      ...testOptions(root, undefined),
      feedUrl: url,
    });
    assert.equal(loaded.releases.length, feed.releases.length);
  });

  it('uses a fresh cached feed without fetching', async function () {
    clearFeedMemoryCache();
    const root = await tmpDir();
    const feed = await fixtureFeed();
    const url = 'http://127.0.0.1:1/fresh.json';
    await put(path.join(root, 'state', 'releases.v2.json'), {
      url,
      fetchedAt: Date.now(),
      feed,
    });
    const loaded = await getReleasesFeed({
      ...testOptions(root, undefined),
      feedUrl: url,
    });
    assert.equal(loaded.generatedAt, feed.generatedAt);
  });

  it('fails clearly when there is no feed at all', async function () {
    clearFeedMemoryCache();
    const root = await tmpDir();
    await assert.rejects(
      getReleasesFeed({
        ...testOptions(root, undefined),
        feedUrl: 'http://127.0.0.1:1/none.json',
      }),
      (err) => isLauncherError(err, 'FEED_UNAVAILABLE'),
    );
  });
});
