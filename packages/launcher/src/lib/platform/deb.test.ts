import assert from 'node:assert/strict';
import { lstat, readFile, readlink, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import zlib from 'node:zlib';
import { tmpDir } from '../../test/helpers.ts';
import { listArEntries, unpackDeb } from './deb.ts';

// File modes and symlinks aren't meaningful on Windows filesystems
const posixFs = process.platform !== 'win32';

interface TarEntryInput {
  name: string;
  type?: '0' | '1' | '2' | '5' | 'x';
  data?: string | Buffer;
  mode?: number;
  linkname?: string;
  prefix?: string;
}

function tarHeader(input: TarEntryInput, size: number) {
  const h = Buffer.alloc(512);
  const octal = (n: number, width: number) =>
    n.toString(8).padStart(width - 1, '0') + '\0';
  h.write(input.name, 0, 100, 'utf8');
  h.write(octal(input.mode ?? 0o644, 8), 100, 'latin1');
  h.write(octal(0, 8), 108, 'latin1');
  h.write(octal(0, 8), 116, 'latin1');
  h.write(octal(size, 12), 124, 'latin1');
  h.write(octal(0, 12), 136, 'latin1');
  h.write('        ', 148, 'latin1');
  h.write(input.type ?? '0', 156, 'latin1');
  h.write(input.linkname ?? '', 157, 100, 'utf8');
  h.write('ustar\0', 257, 'latin1');
  h.write('00', 263, 'latin1');
  h.write(input.prefix ?? '', 345, 155, 'utf8');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'latin1');
  return h;
}

function paxData(records: Record<string, string>) {
  let out = '';
  for (const [key, value] of Object.entries(records)) {
    const body = ` ${key}=${value}\n`;
    let length = body.length + 1;
    while (`${length}${body}`.length !== length) length++;
    out += `${length}${body}`;
  }
  return out;
}

function makeTar(entries: TarEntryInput[]) {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? '');
    parts.push(tarHeader(entry, data.length), data);
    const pad = (512 - (data.length % 512)) % 512;
    parts.push(Buffer.alloc(pad));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

function makeAr(members: { name: string; data: Buffer }[]) {
  const parts: Buffer[] = [Buffer.from('!<arch>\n', 'latin1')];
  for (const { name, data } of members) {
    const header =
      `${name}/`.padEnd(16) +
      '0'.padEnd(12) +
      '0'.padEnd(6) +
      '0'.padEnd(6) +
      '100644'.padEnd(8) +
      String(data.length).padEnd(10) +
      '`\n';
    parts.push(Buffer.from(header, 'latin1'), data);
    if (data.length % 2) parts.push(Buffer.from('\n'));
  }
  return Buffer.concat(parts);
}

async function writeDeb(
  dir: string,
  entries: TarEntryInput[],
  compression: 'zst' | 'gz' | 'none' = 'zst',
) {
  const tar = makeTar(entries);
  const data =
    compression === 'zst'
      ? zlib.zstdCompressSync(tar)
      : compression === 'gz'
        ? zlib.gzipSync(tar)
        : tar;
  const deb = path.join(dir, 'test.deb');
  await writeFile(
    deb,
    makeAr([
      { name: 'debian-binary', data: Buffer.from('2.0\n') },
      // Odd length, to check the ar padding
      { name: 'control.tar.zst', data: Buffer.from('x') },
      {
        name: compression === 'none' ? 'data.tar' : `data.tar.${compression}`,
        data,
      },
    ]),
  );
  return deb;
}

const longDir = `opt/GameMaker-Beta/x86_64/${'deep/'.repeat(25)}`;

const gameMakerDeb: TarEntryInput[] = [
  { name: './', type: '5', mode: 0o755 },
  { name: './opt/', type: '5', mode: 0o755 },
  { name: './opt/GameMaker-Beta/', type: '5', mode: 0o755 },
  {
    name: './opt/GameMaker-Beta/GameMaker',
    data: '#!/usr/bin/env bash\n',
    mode: 0o755,
  },
  { name: './opt/GameMaker-Beta/x86_64/', type: '5', mode: 0o755 },
  {
    name: './opt/GameMaker-Beta/x86_64/GameMaker',
    data: Buffer.alloc(70_000, 7),
    mode: 0o755,
  },
  {
    name: './opt/GameMaker-Beta/x86_64/matching.runtime',
    data: '2026.100.0.1133',
  },
  { name: './opt/GameMaker-Beta/x86_64/empty', data: '' },
  // A long name via a pax header...
  { name: 'PaxHeader', type: 'x', data: paxData({ path: `${longDir}a.txt` }) },
  { name: 'truncated', data: 'pax' },
  // ...and via the ustar prefix field
  { name: 'b.txt', prefix: longDir.slice(0, -1), data: 'prefix' },
  {
    name: './opt/GameMaker-Beta/x86_64/libfoo.so',
    type: '2',
    linkname: 'libfoo.so.1',
  },
  {
    name: './opt/GameMaker-Beta/x86_64/hard',
    type: '1',
    linkname: './opt/GameMaker-Beta/x86_64/matching.runtime',
  },
  { name: './usr/share/applications/GameMaker-Beta.desktop', data: 'x' },
];

const optPkg = (p: string) =>
  p.match(/^opt\/(GameMaker(?:-[A-Za-z0-9]+)?(?:\/.*)?)$/)?.[1];

describe('Deb unpacking', function () {
  it('lists ar entries, handling padding', async function () {
    const dir = await tmpDir();
    const deb = await writeDeb(dir, gameMakerDeb);
    const names = (await listArEntries(deb)).map((e) => e.name);
    assert.deepEqual(names, [
      'debian-binary',
      'control.tar.zst',
      'data.tar.zst',
    ]);
  });

  for (const compression of ['zst', 'gz', 'none'] as const) {
    it(`unpacks a ${compression} deb, keeping modes and links`, async function () {
      const dir = await tmpDir();
      const deb = await writeDeb(dir, gameMakerDeb, compression);
      const dest = path.join(dir, 'out');
      const stats = await unpackDeb(deb, dest, optPkg);
      assert.equal(stats.files, 6);
      const x64 = path.join(dest, 'GameMaker-Beta', 'x86_64');
      assert.equal((await stat(path.join(x64, 'GameMaker'))).size, 70_000);
      assert.equal(
        await readFile(path.join(x64, 'matching.runtime'), 'utf8'),
        '2026.100.0.1133',
      );
      assert.equal((await stat(path.join(x64, 'empty'))).size, 0);
      const deep = path.join(dest, ...optPkg(longDir)!.split('/'));
      assert.equal(await readFile(path.join(deep, 'a.txt'), 'utf8'), 'pax');
      assert.equal(await readFile(path.join(deep, 'b.txt'), 'utf8'), 'prefix');
      assert.equal(
        await readFile(path.join(x64, 'hard'), 'utf8'),
        '2026.100.0.1133',
      );
      // Filtered out
      await assert.rejects(stat(path.join(dest, 'usr')));
      if (posixFs) {
        assert.equal(
          (await stat(path.join(x64, 'GameMaker'))).mode & 0o777,
          0o755,
        );
        assert.equal(
          (await stat(path.join(x64, 'matching.runtime'))).mode & 0o777,
          0o644,
        );
        assert.ok((await lstat(path.join(x64, 'libfoo.so'))).isSymbolicLink());
        assert.equal(
          await readlink(path.join(x64, 'libfoo.so')),
          'libfoo.so.1',
        );
      }
    });
  }

  it('refuses paths that escape the destination', async function () {
    const dir = await tmpDir();
    const deb = await writeDeb(dir, [
      { name: './opt/GameMaker-Beta/../../../evil', data: 'x' },
    ]);
    await assert.rejects(unpackDeb(deb, path.join(dir, 'out')), /unsafe path/);
    await assert.rejects(stat(path.join(dir, 'evil')));
  });

  it(
    'refuses symlinks that point outside the package',
    { skip: !posixFs },
    async function () {
      const dir = await tmpDir();
      for (const linkname of ['/etc/passwd', '../../../outside']) {
        const deb = await writeDeb(dir, [
          { name: './opt/GameMaker-Beta/link', type: '2', linkname },
        ]);
        await assert.rejects(
          unpackDeb(deb, path.join(dir, 'out'), optPkg),
          /outside the package/,
        );
      }
    },
  );

  it('fails clearly on files that are not debs', async function () {
    const dir = await tmpDir();
    const file = path.join(dir, 'not.deb');
    await writeFile(file, 'hello');
    await assert.rejects(
      unpackDeb(file, path.join(dir, 'out')),
      /not an ar archive/,
    );
  });
});
