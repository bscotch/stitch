import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathy } from '@bscotch/pathy';
import { createInterface } from 'node:readline/promises';
import { GameMakerComponent } from './GameMakerComponent.ts';
import { GameMakerIde } from './GameMakerIde.ts';
import { GameMakerLauncher } from './GameMakerLauncher.ts';
import { bootstrapRuntimeVersion, type RuntimeFeedsFile } from './utility.ts';

// 2022.300.0.476 runtime version *SHOULD* be able to install other runtimes without requiring an Enterprise license

const sampleProjectPath = 'samples/project/project.yyp';
const sampleProjectCompatibleIde = '2022.600.0.147'; //'2022.500.0.97'; //'2022.500.0.88'; //'2022.600.0.147';
const sampleProjectCompatibleRuntime = '2022.600.0.121';

describe.skip('GameMakerLauncher', function () {
  it('can list known filepaths', async function () {
    const paths = await GameMakerComponent.listWellKnownPaths();
    assert.ok(paths.length > 0);
  });

  it('can ensure runtime feeds are available to the IDE', async function () {
    await GameMakerComponent.ensureOfficialRuntimeFeeds();
    const feedConfigs = (await GameMakerComponent.listWellKnownPaths()).filter(
      (p) => p.id === 'runtimeFeedsConfigFile',
    );
    for (const configInfo of feedConfigs) {
      const feedConfig = await pathy(configInfo.path).read<RuntimeFeedsFile>();
      assert.ok(feedConfig.length >= 2);
    }
  });

  it('can list available releases', async function () {
    const releases = await GameMakerComponent.listReleases();
    assert.ok(Array.isArray(releases));
    assert.ok(releases.length > 0);
    const counts = {
      lts: 0,
      stable: 0,
      beta: 0,
      unstable: 0,
    };
    for (const version of releases) {
      counts[version.channel]++;
      assert.match(version.ide.version, /^\d+\.\d+\.\d+\.\d+$/);
      assert.match(version.runtime.version, /^\d+\.\d+\.\d+\.\d+$/);
    }
    assert.ok(counts.lts > 0);
    assert.ok(counts.stable > 0);
    assert.ok(counts.beta > 0);
    assert.ok(counts.unstable > 0);
  });

  it('has the bootstrap runtime available', async function () {
    const runtime = await GameMakerLauncher.findInstalledRuntime({
      version: bootstrapRuntimeVersion,
    });
    assert.ok(
      typeof runtime === 'object' && runtime !== null,
      `You must manually install runtime version ${bootstrapRuntimeVersion} in order to use Stitch Launcher. It is required to bootstrap installs of other runtimes.`,
    );
  });

  it(
    'can install an IDE version',
    { timeout: 1000 * 60 * 10 },
    async function () {
      // (Downloads and installs can take a while)
      console.log('Installing IDE', sampleProjectCompatibleIde, '...');
      const installedVersion = await GameMakerIde.install(
        sampleProjectCompatibleIde,
      );
      assert.equal(installedVersion.version, sampleProjectCompatibleIde);
      assert.equal(
        await GameMakerIde.cachedIdeDirectory(
          sampleProjectCompatibleIde,
        ).exists(),
        true,
      );
    },
  );

  it(
    'can install a Runtime version',
    { timeout: 1000 * 60 * 10 },
    async function () {
      console.log('Installing', sampleProjectCompatibleRuntime, '...');
      const installedVersion = await GameMakerLauncher.installRuntime(
        sampleProjectCompatibleRuntime,
        bootstrapRuntimeVersion,
      );
      assert.equal(installedVersion.version, sampleProjectCompatibleRuntime);
    },
  );

  it('can list installed IDE versions', async function () {
    const installed = await GameMakerIde.listInstalled();
    assert.ok(Array.isArray(installed));
    assert.ok(installed.length > 0);
  });

  it('can list installed Runtimes', async function () {
    const installed = await GameMakerLauncher.listInstalledRuntimes();
    assert.ok(Array.isArray(installed));
    assert.ok(installed.length > 0);
  });

  it(
    'can run a project with a given Runtime',
    { timeout: 1000 * 60 * 2 },
    async function () {
      // Requires running a project, which could take a little time
      console.log(
        'Running project with runtime version',
        sampleProjectCompatibleRuntime,
        '...',
      );
      const runnerResults = await GameMakerLauncher.runProject(
        {
          project: sampleProjectPath,
        },
        sampleProjectCompatibleRuntime,
      );
      assert.equal(
        runnerResults.compileSucceeded,
        true,
        'Should have compiled',
      );
      assert.equal(
        runnerResults.runnerSucceeded,
        true,
        'Should have run without error',
      );
    },
  );

  it(
    'can open a project with a given IDE and inferred Runtime version',
    { timeout: 1000 * 60 * 10 },
    async function () {
      // Requires manual checking and booting up the IDE,
      // all of that could take a bit!
      console.log(`Opening IDE v${sampleProjectCompatibleIde}`);
      const opener = await GameMakerLauncher.openProject(sampleProjectPath, {
        ideVersion: sampleProjectCompatibleIde,
      });
      assert.equal(typeof opener.runtimeVersion, 'string');

      const hasCorrectVersions = await confirm(
        `Is the IDE version ${sampleProjectCompatibleIde} and the Runtime version ${opener.runtimeVersion}?`,
      );
      assert.equal(
        hasCorrectVersions,
        true,
        'Opened IDE should have used correct versions',
      );
      opener.close();
    },
  );

  it(
    'can open a project with a given IDE and Runtime version',
    { timeout: 1000 * 60 * 10 },
    async function () {
      // Requires manual checking and booting up the IDE,
      // all of that could take a bit!
      console.log(
        `Opening IDE v${sampleProjectCompatibleIde} with Runtime v${sampleProjectCompatibleRuntime}`,
      );
      const opener = await GameMakerLauncher.openProject(sampleProjectPath, {
        ideVersion: sampleProjectCompatibleIde,
        runtimeVersion: sampleProjectCompatibleRuntime,
      });
      const hasCorrectVersions = await confirm(
        `Is the IDE version ${sampleProjectCompatibleIde} and the Runtime version ${sampleProjectCompatibleRuntime}?`,
      );
      assert.equal(
        hasCorrectVersions,
        true,
        'Opened IDE should have used correct versions',
      );
      opener.close();
    },
  );
});

/** Ask a yes/no question on the terminal (defaults to yes). */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${message} (Y/n) `);
    return !/^n/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
