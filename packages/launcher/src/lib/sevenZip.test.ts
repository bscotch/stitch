import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { samplesDir } from '../test/helpers.ts';
import { isLauncherError } from './errors.ts';
import { resolveOptions } from './options.ts';
import {
  findSevenZip,
  listSevenZipCandidates,
  parseSevenZipFormats,
  parseSevenZipVersion,
  type SevenZipProbe,
} from './sevenZip.ts';

const full = () =>
  readFile(path.join(samplesDir, 'seven-zip', '7z-i.windows.txt'), 'utf8');

/** Shaped like the standalone 7za's output, which has only a few formats */
const standalone = `
7-Zip (a) 26.06 (x64) : Copyright (c) 1999-2026 Igor Pavlov : 2026-01-01

Formats:
 0 C...F..........c.a.m+.. w...0  7z       7z            7 z BC AF ' 1C
 0 C.....................  gzip     gz gzip tgz (.tar) 1F 8B
 0 CK....................  tar      tar ova       offset=257 u s t a r
 0 C...F..........c.a.m+..  zip      zip z01 zipx  P K 03 04

Codecs:
 0 4ED   303011B BCJ2
`;

const fakeProbe = (outputs: Record<string, string>): SevenZipProbe => ({
  exists: (p) => Promise.resolve(p in outputs),
  info: (p) => Promise.resolve(outputs[p]),
});

const winOpts = (extra = {}) =>
  resolveOptions({
    os: 'windows',
    platformEnv: {
      homedir: 'C:\\Users\\me',
      env: { PATH: 'C:\\bin;C:\\tools' },
      arch: 'x64',
    },
    ...extra,
  });

describe('7-Zip', function () {
  it('parses formats from the full build', async function () {
    const formats = parseSevenZipFormats(await full());
    for (const f of ['7z', 'Nsis', 'Xar', 'Ar', 'Cpio', 'zip']) {
      assert.ok(formats.includes(f), `Missing ${f}`);
    }
    assert.equal(parseSevenZipVersion(await full()), '23.01');
  });

  it('parses formats from the standalone build', function () {
    assert.deepEqual(parseSevenZipFormats(standalone), [
      '7z',
      'gzip',
      'tar',
      'zip',
    ]);
    assert.equal(parseSevenZipVersion(standalone), '26.06');
  });

  it('only uses the override when one is given', async function () {
    const candidates = await listSevenZipCandidates(
      winOpts({ sevenZipPath: 'D:\\7z.exe' }),
    );
    assert.deepEqual(candidates, ['D:\\7z.exe']);
  });

  it('tries the PATH before the usual locations', async function () {
    const candidates = await listSevenZipCandidates(winOpts());
    assert.deepEqual(candidates.slice(0, 2), [
      'C:\\bin\\7z.exe',
      'C:\\tools\\7z.exe',
    ]);
  });

  it('skips builds that lack the needed format', async function () {
    const found = await findSevenZip(
      winOpts(),
      fakeProbe({
        'C:\\bin\\7z.exe': standalone,
        'C:\\tools\\7z.exe': await full(),
      }),
    );
    assert.equal(found.path, 'C:\\tools\\7z.exe');
    assert.ok(found.formats.includes('Nsis'));
  });

  it('explains what was found when no build is capable', async function () {
    await assert.rejects(
      findSevenZip(winOpts(), fakeProbe({ 'C:\\bin\\7z.exe': standalone })),
      (err) => {
        assert.ok(isLauncherError(err, 'SEVEN_ZIP_INCAPABLE'));
        assert.deepEqual(err.data.found, [
          { path: 'C:\\bin\\7z.exe', version: '26.06' },
        ]);
        assert.equal(err.data.requiredFormat, 'Nsis');
        assert.equal(err.data.installCommand, 'winget install 7zip.7zip');
        assert.match(err.message, /7-zip\.org/);
        return true;
      },
    );
  });

  it('requires the OS-specific format', async function () {
    const mac = resolveOptions({
      os: 'mac',
      platformEnv: {
        homedir: '/Users/me',
        env: { PATH: '/opt/homebrew/bin' },
        arch: 'arm64',
      },
    });
    const found = await findSevenZip(
      mac,
      fakeProbe({ '/opt/homebrew/bin/7zz': await full() }),
    );
    assert.equal(found.path, '/opt/homebrew/bin/7zz');
    await assert.rejects(findSevenZip(mac, fakeProbe({})), (err) =>
      isLauncherError(err, 'SEVEN_ZIP_MISSING'),
    );
  });
});
