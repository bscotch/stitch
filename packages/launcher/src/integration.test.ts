/**
 * @file Integration tests against real GameMaker installs. Every suite is
 * opt-in via an env var:
 *
 * - `STITCH_LAUNCHER_INTEGRATION=1`: read-only checks of this machine's
 *   runtimes and prerequisites, and an Igor `PackageZip` of
 *   `samples/project` into temp dirs. Needs the runtime that matches the
 *   sample project's IDE to be installed (see `samples/project/project.yyp`).
 * - `STITCH_LAUNCHER_INTEGRATION_INSTALL=1`: `installIde` into a temp cache,
 *   downloading the installer (~500 MB) into the Downloads folder (reused if
 *   it's already there).
 * - `STITCH_LAUNCHER_INTEGRATION_IDE=1`: opens a temp copy of the sample
 *   project in the GameMaker IDE, installing the IDE into the real IDE cache
 *   first if needed. Temporarily changes its channel's `default_macros.json`,
 *   and migrates old-launcher leftovers there (back it up!).
 *
 * Optional:
 * - `STITCH_LAUNCHER_IDE_VERSION`: use this IDE version instead of the
 *   sample project's.
 * - `STITCH_LAUNCHER_FEED_FILE`: use a local v2 releases feed file instead
 *   of fetching it.
 */
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  checkPrerequisites,
  computeGameMakerDirs,
  findIde,
  findRuntime,
  getIdeVersionDetails,
  installIde,
  listInstalledRuntimes,
  openProject,
  readProjectIdeVersion,
  resolveOptions,
  restoreUpdatePrompts,
  runIgor,
  type LauncherOptions,
} from './index.ts';
import { samplesDir } from './test/helpers.ts';

const enabled = (name: string) =>
  process.env[name] === '1' || process.env[name] === 'true';
const sampleProject = path.join(samplesDir, 'project', 'project.yyp');

async function launcherOptions(): Promise<LauncherOptions> {
  const feedFile = process.env.STITCH_LAUNCHER_FEED_FILE;
  return feedFile ? { feed: JSON.parse(await readFile(feedFile, 'utf8')) } : {};
}

async function testIdeVersion() {
  return (
    process.env.STITCH_LAUNCHER_IDE_VERSION ||
    (await readProjectIdeVersion(sampleProject))
  );
}

async function tmp() {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), 'stitch-launcher-integration-'),
  );
  after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

describe(
  'Integration: runtimes and Igor',
  { skip: !enabled('STITCH_LAUNCHER_INTEGRATION') },
  function () {
    it('finds installed runtimes', async function () {
      const runtimes = await listInstalledRuntimes();
      assert.ok(runtimes.length > 0, 'No runtimes installed');
      for (const runtime of runtimes) {
        assert.ok((await stat(runtime.igorPath)).isFile());
        assert.ok(runtime.modules.some((m) => m.name === 'base'));
      }
    });

    it('finds the prerequisites', async function () {
      const prereqs = await checkPrerequisites();
      assert.ok(!(prereqs.sevenZip instanceof Error), String(prereqs.sevenZip));
      if (process.platform === 'win32') assert.equal(prereqs.vcRuntime, true);
      const downloads = await resolveOptions().downloadsDir();
      assert.ok((await stat(downloads)).isDirectory(), downloads);
    });

    it(
      'packages the sample project',
      { timeout: 10 * 60_000 },
      async function () {
        const ideVersion = await testIdeVersion();
        const details = await getIdeVersionDetails(
          ideVersion,
          await launcherOptions(),
        );
        const runtime = await findRuntime(details.runtimeVersion);
        assert.ok(
          runtime,
          `Runtime ${details.runtimeVersion} (for IDE ${ideVersion}) is not installed`,
        );
        const dir = await tmp();
        const outputFile = path.join(dir, 'out', 'project.zip');
        const result = await runIgor(
          {
            project: sampleProject,
            runtime,
            command: 'PackageZip',
            outputFile,
          },
          { igorCacheDir: path.join(dir, 'igor') },
        );
        assert.equal(
          result.exitCode,
          0,
          `Igor failed, see ${result.logFile}:\n${result.stdout.slice(-3000)}`,
        );
        assert.ok((await stat(outputFile)).size > 0);
      },
    );
  },
);

describe(
  'Integration: installing an IDE',
  { skip: !enabled('STITCH_LAUNCHER_INTEGRATION_INSTALL') },
  function () {
    it(
      'downloads and extracts the sample project IDE',
      { timeout: 30 * 60_000 },
      async function () {
        const dir = await tmp();
        const options = {
          ...(await launcherOptions()),
          ideCacheDir: path.join(dir, 'ide'),
        };
        const ideVersion = await testIdeVersion();
        const ide = await installIde(ideVersion, options);
        assert.ok((await stat(ide.executable)).isFile());
        assert.ok(ide.pairedRuntimeVersion);
        assert.deepEqual(await findIde(ideVersion, options), ide);
      },
    );
  },
);

describe(
  'Integration: opening the IDE',
  { skip: !enabled('STITCH_LAUNCHER_INTEGRATION_IDE') },
  function () {
    it(
      'opens, suppresses the update prompt, restores it, and closes',
      { timeout: 5 * 60_000 },
      async function () {
        const options = await launcherOptions();
        const ideVersion = await testIdeVersion();
        const ide =
          (await findIde(ideVersion, options)) ??
          (await installIde(ideVersion, options));
        const dirs = computeGameMakerDirs(
          ide.programDirName,
          resolveOptions(options),
        );
        const readMacros = () =>
          readFile(dirs.defaultMacros, 'utf8').catch(() => undefined);

        // Open a copy, so the IDE can't modify the fixture
        const dir = await tmp();
        await cp(path.dirname(sampleProject), path.join(dir, 'project'), {
          recursive: true,
          filter: (src) => !/[\\/](tmp|logs)$/.test(src),
        });
        const project = path.join(dir, 'project', 'project.yyp');

        // Clean up any old-launcher leftovers first, so "before" is the
        // state the launcher should restore.
        await restoreUpdatePrompts(options);
        const before = await readMacros();
        assert.doesNotMatch(before || '', /TOTALLY-FAKE/);

        const running = await openProject(project, { ...options, ideVersion });
        assert.match((await readMacros()) || '', /update-stitch-disabled/);
        // Wait for the boot-time update check, after which the original returns
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline && (await readMacros()) !== before) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        assert.equal(
          await readMacros(),
          before,
          'default_macros.json was not restored',
        );
        assert.ok(running.pids.length > 0, 'No IDE processes found');
        assert.ok(await running.isRunning());
        await running.close();
        await running.waitForClose();
      },
    );
  },
);
