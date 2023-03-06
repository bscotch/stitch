import { pathy } from '@bscotch/pathy';
import { expect } from 'chai';
import { default as inquirer } from 'inquirer';
import { GameMakerComponent } from './GameMakerComponent.js';
import { GameMakerIde } from './GameMakerIde.js';
import { GameMakerLauncher } from './GameMakerLauncher.js';
import { bootstrapRuntimeVersion, RuntimeFeedsFile } from './utility.js';

// 2022.300.0.476 runtime version *SHOULD* be able to install other runtimes without requiring an Enterprise license

const sampleProjectPath = 'samples/project/project.yyp';
const sampleProjectCompatibleIde = '2022.600.0.147'; //'2022.500.0.97'; //'2022.500.0.88'; //'2022.600.0.147';
const sampleProjectCompatibleRuntime = '2022.600.0.121';

xdescribe('GameMakerLauncher', function () {
  it('can list known filepaths', async function () {
    const paths = await GameMakerComponent.listWellKnownPaths();
    expect(paths.length).to.be.greaterThan(0);
  });

  it('can ensure runtime feeds are available to the IDE', async function () {
    await GameMakerComponent.ensureOfficialRuntimeFeeds();
    const feedConfigs = (await GameMakerComponent.listWellKnownPaths()).filter(
      (p) => p.id === 'runtimeFeedsConfigFile',
    );
    for (const configInfo of feedConfigs) {
      const feedConfig = await pathy(configInfo.path).read<RuntimeFeedsFile>();
      expect(feedConfig.length).to.be.at.least(2);
    }
  });

  it('can list available releases', async function () {
    const releases = await GameMakerComponent.listReleases();
    expect(releases).to.be.an('array');
    expect(releases).to.have.length.greaterThan(0);
    const counts = {
      lts: 0,
      stable: 0,
      beta: 0,
      unstable: 0,
    };
    for (const version of releases) {
      counts[version.channel]++;
      expect(version.ide.version).to.match(/^\d+\.\d+\.\d+\.\d+$/);
      expect(version.runtime.version).to.match(/^\d+\.\d+\.\d+\.\d+$/);
    }
    expect(counts.lts).to.be.greaterThan(0);
    expect(counts.stable).to.be.greaterThan(0);
    expect(counts.beta).to.be.greaterThan(0);
    expect(counts.unstable).to.be.greaterThan(0);
  });

  it('has the bootstrap runtime available', async function () {
    const runtime = await GameMakerLauncher.findInstalledRuntime({
      version: bootstrapRuntimeVersion,
    });
    expect(
      runtime,
      `You must manually install runtime version ${bootstrapRuntimeVersion} in order to use Stitch Launcher. It is required to bootstrap installs of other runtimes.`,
    ).to.be.an('object');
  });

  it('can install an IDE version', async function () {
    // (Downloads and installs can take a while)
    this.timeout(1000 * 60 * 10);
    console.log('Installing IDE', sampleProjectCompatibleIde, '...');
    const installedVersion = await GameMakerIde.install(
      sampleProjectCompatibleIde,
    );
    expect(installedVersion.version).to.equal(sampleProjectCompatibleIde);
    expect(
      await GameMakerIde.cachedIdeDirectory(
        sampleProjectCompatibleIde,
      ).exists(),
    ).to.be.true;
  });

  it('can install a Runtime version', async function () {
    this.timeout(1000 * 60 * 10);
    console.log('Installing', sampleProjectCompatibleRuntime, '...');
    const installedVersion = await GameMakerLauncher.installRuntime(
      sampleProjectCompatibleRuntime,
      bootstrapRuntimeVersion,
    );
    expect(installedVersion.version).to.equal(sampleProjectCompatibleRuntime);
  });

  it('can list installed IDE versions', async function () {
    const installed = await GameMakerIde.listInstalled();
    expect(installed).to.be.an('array');
    expect(installed).to.have.length.greaterThan(0);
  });

  it('can list installed Runtimes', async function () {
    const installed = await GameMakerLauncher.listInstalledRuntimes();
    expect(installed).to.be.an('array');
    expect(installed).to.have.length.greaterThan(0);
  });

  it('can run a project with a given Runtime', async function () {
    // Requires running a project, which could take a little time
    this.timeout(1000 * 60 * 2);
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
    expect(runnerResults.compileSucceeded, 'Should have compiled').to.be.true;
    expect(runnerResults.runnerSucceeded, 'Should have run without error').to.be
      .true;
  });

  it('can open a project with a given IDE and inferred Runtime version', async function () {
    // Requires manual checking and booting up the IDE,
    // all of that could take a bit!
    this.timeout(1000 * 60 * 10);
    console.log(`Opening IDE v${sampleProjectCompatibleIde}`);
    const opener = await GameMakerLauncher.openProject(sampleProjectPath, {
      ideVersion: sampleProjectCompatibleIde,
    });
    expect(opener.runtimeVersion).to.be.a('string');

    const { hasCorrectVersions } = await inquirer.prompt([
      {
        type: 'confirm',
        message: `Is the IDE version ${sampleProjectCompatibleIde} and the Runtime version ${opener.runtimeVersion}?`,
        name: 'hasCorrectVersions',
      },
    ]);
    expect(hasCorrectVersions, 'Opened IDE should have used correct versions')
      .to.be.true;
    opener.close();
  });

  it('can open a project with a given IDE and Runtime version', async function () {
    // Requires manual checking and booting up the IDE,
    // all of that could take a bit!
    this.timeout(1000 * 60 * 10);
    console.log(
      `Opening IDE v${sampleProjectCompatibleIde} with Runtime v${sampleProjectCompatibleRuntime}`,
    );
    const opener = await GameMakerLauncher.openProject(sampleProjectPath, {
      ideVersion: sampleProjectCompatibleIde,
      runtimeVersion: sampleProjectCompatibleRuntime,
    });
    const { hasCorrectVersions } = await inquirer.prompt([
      {
        type: 'confirm',
        message: `Is the IDE version ${sampleProjectCompatibleIde} and the Runtime version ${sampleProjectCompatibleRuntime}?`,
        name: 'hasCorrectVersions',
      },
    ]);
    expect(hasCorrectVersions, 'Opened IDE should have used correct versions')
      .to.be.true;
    opener.close();
  });
});
