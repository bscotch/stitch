import assert from 'node:assert/strict';
import { readdir, readFile, utimes } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { exists } from '../fsUtil.ts';
import { resolveOptions } from '../options.ts';
import { put, samplesDir, testOptions, tmpDir } from '../../test/helpers.ts';
import {
  getIgorCacheInfo,
  igorCacheKey,
  pruneIgorCache,
  useIgorCacheEntry,
} from './cache.ts';
import { igorCommands, igorOptionFlags, igorWorkers } from './cliTypes.ts';
import {
  buildIgorCommand,
  formatShellCommand,
  igorArtifactExtension,
  type ResolvedIgorOptions,
} from './command.ts';
import { parseIgorHelp } from './parseHelp.ts';

const win = path.win32;
const base: ResolvedIgorOptions = {
  os: 'windows',
  path: win,
  igorPath:
    'C:\\ProgramData\\GameMakerStudio2-Beta\\Cache\\runtimes\\runtime-2026.100.0.1133\\bin\\igor\\windows\\x64\\Igor.exe',
  runtimeDir:
    'C:\\ProgramData\\GameMakerStudio2-Beta\\Cache\\runtimes\\runtime-2026.100.0.1133',
  project: 'C:\\Projects\\My Game\\MyGame.yyp',
  target: 'windows',
  command: 'Run',
  compiler: 'vm',
  userDir: 'C:\\Users\\me\\AppData\\Roaming\\GameMakerStudio2-Beta\\me_1',
  cacheDir: 'C:\\cache\\MyGame-abc\\cache',
  tempDir: 'C:\\cache\\MyGame-abc\\temp',
  outDir: 'C:\\cache\\MyGame-abc\\out',
  outputFile: 'C:\\Projects\\My Game\\MyGame.zip',
  verbose: true,
  env: { PATH: 'C:\\Windows', Path: 'C:\\Windows', OTHER: '1' },
};

describe('Igor help parsing', function () {
  it("parses the current Igor's help output", async function () {
    const help = parseIgorHelp(
      await readFile(path.join(samplesDir, 'igor-help.txt'), 'utf8'),
    );
    const workers = Object.keys(help.workers);
    for (const w of [
      'windows',
      'mac',
      'linux',
      'reddit',
      'switch2',
      'runtime',
    ]) {
      assert.ok(workers.includes(w), `Missing worker ${w}`);
    }
    assert.ok(!workers.includes('winuwp') && !workers.includes('xboxone'));
    for (const c of [
      'PackageZipArm64',
      'PackageNsisArm64',
      'CleanCode',
      'PreCleanStep',
      'Compile',
    ]) {
      assert.ok(help.workers.windows.includes(c), `Missing windows ${c}`);
    }
    assert.ok(help.workers.android.includes('AndroidRun_Command'));
    assert.ok(help.workers.xboxseriesxs.includes('DetermineVSVersion'));
    assert.deepEqual(help.workers.runtime, [
      'ListInstalled',
      'Info',
      'Install',
      'List',
      'Verify',
      'FetchLicense',
    ]);

    const option = (key: string) => help.options.find((o) => o.key === key);
    assert.deepEqual(option('runtimePath'), {
      key: 'runtimePath',
      names: ['rp', 'runtimePath'],
      flag: '--runtimePath',
      takesValue: true,
      description: 'path to the runtime to use',
    });
    assert.equal(option('j')?.flag, '-j');
    assert.equal(option('launch')?.takesValue, false);
    for (const key of ['nobuild', 'prefabs', 'projectool', 'ssdk', 'mqtt']) {
      assert.ok(option(key), `Missing option ${key}`);
    }
    assert.match(
      option('temp')!.description,
      /temporary files created during build/,
    );
  });

  it('matches the generated types', async function () {
    const help = parseIgorHelp(
      await readFile(path.join(samplesDir, 'igor-help.txt'), 'utf8'),
    );
    assert.deepEqual([...igorWorkers], Object.keys(help.workers));
    assert.deepEqual([...igorCommands.windows], help.workers.windows);
    assert.deepEqual(
      Object.keys(igorOptionFlags),
      help.options.map((o) => o.key),
    );
  });
});

describe('Igor commands', function () {
  it('builds a Run command', function () {
    const command = buildIgorCommand(base);
    assert.equal(command.cmd, base.igorPath);
    assert.deepEqual(command.args, [
      '--project=C:\\Projects\\My Game\\MyGame.yyp',
      `--user=${base.userDir}`,
      `--runtimePath=${base.runtimeDir}`,
      '--runtime=VM',
      '--verbose',
      '--cache=C:\\cache\\MyGame-abc\\cache',
      '--temp=C:\\cache\\MyGame-abc\\temp',
      '--of=C:\\cache\\MyGame-abc\\out\\MyGame.win',
      '--tf=C:\\Projects\\My Game\\MyGame.zip',
      '--',
      'windows',
      'Run',
    ]);
    assert.equal(command.cwd, 'C:\\Projects\\My Game');
  });

  it('builds YYC, config, ignore-cache, and extra options', function () {
    const { args } = buildIgorCommand({
      ...base,
      command: 'PackageZip',
      compiler: 'yyc',
      config: 'Release',
      ignoreCache: true,
      verbose: false,
      extra: { j: 8, launch: true, user: 'D:\\override' },
    });
    assert.ok(args.includes('--runtime=YYC'));
    assert.ok(args.includes('--config=Release'));
    assert.ok(args.includes('--ignorecache'));
    assert.ok(!args.includes('--verbose'));
    assert.ok(args.includes('-j=8'));
    assert.ok(args.includes('--launch'));
    assert.ok(args.includes('--user=D:\\override'));
    assert.deepEqual(args.slice(-3), ['--', 'windows', 'PackageZip']);
  });

  it('drops PATH on Windows only (it breaks MSBuild)', function () {
    const env = buildIgorCommand(base).env;
    assert.deepEqual(env, { OTHER: '1' });
    const posix = buildIgorCommand({
      ...base,
      os: 'linux',
      path: path.posix,
      env: { PATH: '/bin' },
    });
    assert.deepEqual(posix.env, { PATH: '/bin' });
  });

  it('picks artifact extensions', function () {
    assert.equal(igorArtifactExtension('windows', 'PackageZip'), 'zip');
    assert.equal(igorArtifactExtension('windows', 'PackageNsis'), 'exe');
    assert.equal(igorArtifactExtension('android', 'Package'), 'aab');
    assert.equal(igorArtifactExtension('switch2', 'Package'), 'nsp');
  });

  it('quotes commands for shells', function () {
    const cmd = 'C:\\Program Files\\Igor.exe';
    const args = [
      "--project=C:\\My Game\\it's.yyp",
      '--verbose',
      '--',
      'windows',
      'Run',
    ];
    assert.equal(
      formatShellCommand(cmd, args, 'powershell'),
      `& 'C:\\Program Files\\Igor.exe' '--project=C:\\My Game\\it''s.yyp' '--verbose' '--' 'windows' 'Run'`,
    );
    assert.equal(
      formatShellCommand(cmd, args, 'cmd'),
      `"C:\\Program Files\\Igor.exe" "--project=C:\\My Game\\it's.yyp" --verbose -- windows Run`,
    );
    assert.equal(
      formatShellCommand(
        '/opt/rt/Igor',
        ["--project=/a b/it's.yyp", '--', 'linux', 'Run'],
        'posix',
      ),
      `/opt/rt/Igor '--project=/a b/it'\\''s.yyp' -- linux Run`,
    );
  });
});

describe('Igor cache', function () {
  it('names entries by project name and path hash', function () {
    const opts = resolveOptions({ os: 'windows' });
    const a = igorCacheKey('C:\\Projects\\My Game\\MyGame.yyp', opts);
    assert.match(a, /^MyGame-[0-9a-f]{8}$/);
    assert.equal(
      igorCacheKey('c:\\projects\\my game\\MYGAME.yyp', opts).slice(-8),
      a.slice(-8),
      'Case-insensitive on Windows',
    );
    assert.notEqual(igorCacheKey('C:\\Other\\MyGame.yyp', opts), a);
    assert.match(
      igorCacheKey('/x/My Weird Game!.yyp', resolveOptions({ os: 'linux' })),
      /^My_Weird_Game_-[0-9a-f]{8}$/,
    );
  });

  it('wipes an entry when the runtime changes', async function () {
    const root = await tmpDir();
    const options = testOptions(root, undefined);
    const project = path.join(root, 'proj', 'game.yyp');
    await put(project, '{}');
    let dirs = await useIgorCacheEntry(project, '2026.100.0.1133', options);
    await put(path.join(dirs.cache, 'compiled.bin'), 'data');
    dirs = await useIgorCacheEntry(project, '2026.100.0.1133', options);
    assert.ok(
      await exists(path.join(dirs.cache, 'compiled.bin')),
      'Same runtime: kept',
    );
    dirs = await useIgorCacheEntry(project, '2026.100.0.1140', options);
    assert.ok(
      !(await exists(path.join(dirs.cache, 'compiled.bin'))),
      'New runtime: wiped',
    );
    assert.ok(await exists(dirs.temp));
    assert.equal(dirs.entry.meta?.runtimeVersion, '2026.100.0.1140');
  });

  it('auto-prunes stale entries, missing projects, and unreadable metadata', async function () {
    const root = await tmpDir();
    const options = testOptions(root, undefined, { igorCacheMaxAgeDays: 14 });
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const projects = ['current', 'recent', 'old', 'gone'].map((n) =>
      path.join(root, n, `${n}.yyp`),
    );
    for (const p of projects.slice(0, 3)) await put(p, '{}');
    await useIgorCacheEntry(projects[1], '1.0.0.0', options, now - 2 * day);
    await useIgorCacheEntry(projects[2], '1.0.0.0', options, now - 20 * day);
    await useIgorCacheEntry(projects[3], '1.0.0.0', options, now - 1 * day);
    await put(
      path.join(root, 'igor-cache', 'corrupt-12345678', 'stitch-meta.json'),
      '{ nope',
    );
    await useIgorCacheEntry(projects[0], '1.0.0.0', options, now);
    const left = (await readdir(path.join(root, 'igor-cache'))).sort();
    assert.deepEqual(
      left.map((k) => k.split('-')[0]),
      ['current', 'recent'],
    );
  });

  it("doesn't auto-prune when disabled", async function () {
    const root = await tmpDir();
    const options = testOptions(root, undefined, { igorCacheMaxAgeDays: 0 });
    const old = path.join(root, 'old', 'old.yyp');
    const current = path.join(root, 'cur', 'cur.yyp');
    await put(old, '{}');
    await put(current, '{}');
    await useIgorCacheEntry(old, '1.0.0.0', options, 0);
    await useIgorCacheEntry(current, '1.0.0.0', options);
    assert.equal((await readdir(path.join(root, 'igor-cache'))).length, 2);
  });

  it('prunes manually and reports sizes', async function () {
    const root = await tmpDir();
    const options = testOptions(root, undefined);
    for (const n of ['a', 'b']) {
      const project = path.join(root, n, `${n}.yyp`);
      await put(project, '{}');
      const dirs = await useIgorCacheEntry(project, '1.0.0.0', options);
      await put(path.join(dirs.cache, 'x'), 'xxxx');
    }
    const info = await getIgorCacheInfo(options);
    assert.equal(info.length, 2);
    assert.ok(info.every((e) => e.sizeBytes! >= 4 && e.meta));
    const removed = await pruneIgorCache(
      (e) => e.key.startsWith('a-'),
      options,
    );
    assert.equal(removed.length, 1);
    await pruneIgorCache(undefined, options);
    assert.deepEqual(await readdir(path.join(root, 'igor-cache')), []);
  });

  it('treats missing entry dirs as fine', async function () {
    const root = await tmpDir();
    const dir = path.join(root, 'igor-cache');
    assert.deepEqual(
      await pruneIgorCache(undefined, testOptions(root, undefined)),
      [],
    );
    await put(path.join(dir, 'x-00000000', 'stitch-meta.json'), {
      projectPath: 'nope',
      lastUsedAt: 0,
      runtimeVersion: '1',
    });
    const old = new Date(0);
    await utimes(path.join(dir, 'x-00000000'), old, old);
    assert.equal(
      (await getIgorCacheInfo(testOptions(root, undefined))).length,
      1,
    );
  });
});
