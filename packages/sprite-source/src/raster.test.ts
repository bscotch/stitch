import { pathy } from '@bscotch/pathy';
import { encode } from 'fast-png';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { crc32 } from 'node:zlib';
import { Raster } from './raster.ts';
import { SpriteFrame } from './SpriteFrame.ts';

/** Create a PNG from per-pixel channel values */
function png(
  width: number,
  height: number,
  channels: number,
  depth: 8 | 16,
  pixels: number[][],
) {
  const data =
    depth === 16
      ? new Uint16Array(pixels.flat())
      : new Uint8Array(pixels.flat());
  assert.equal(data.length, width * height * channels);
  return encode({ width, height, channels, depth, data });
}

/** Insert a tRNS chunk after the PLTE chunk of an indexed PNG */
function withTransparency(indexedPng: Uint8Array, alphas: number[]) {
  const bytes = Buffer.from(indexedPng);
  let pos = 8;
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString('latin1', pos + 4, pos + 8);
    pos += 12 + length;
    if (type === 'PLTE') break;
  }
  const typeAndData = Buffer.concat([
    Buffer.from('tRNS', 'latin1'),
    Buffer.from(alphas),
  ]);
  const chunk = Buffer.alloc(12 + alphas.length);
  chunk.writeUInt32BE(alphas.length, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + alphas.length);
  return Buffer.concat([bytes.subarray(0, pos), chunk, bytes.subarray(pos)]);
}

const T = [0, 0, 0, 0]; // Transparent black
const R = [255, 0, 0, 255]; // Opaque red

const tmp = await mkdtemp(join(tmpdir(), 'sprite-source-raster-'));
after(() => rm(tmp, { recursive: true, force: true }));

async function frameFrom(name: string, content: Uint8Array) {
  const path = join(tmp, name);
  await writeFile(path, content);
  return new SpriteFrame(pathy(path));
}

async function rasterFrom(frame: SpriteFrame, name: string) {
  const out = pathy(join(tmp, `out-${name}`));
  await frame.saveTo(out);
  return Raster.fromPng(await readFile(out.absolute));
}

describe('Raster', function () {
  it('round-trips PNG data in its original format', function () {
    for (const [channels, depth] of [
      [1, 8],
      [2, 8],
      [3, 8],
      [4, 8],
      [2, 16],
      [4, 16],
    ] as const) {
      const max = 2 ** depth - 1;
      const pixels = [...Array(6)].map((_, i) =>
        [...Array(channels)].map((_, c) => (i * 7 + c * 13) % (max + 1)),
      );
      const raster = Raster.fromPng(png(3, 2, channels, depth, pixels));
      assert.equal(raster.channels, channels);
      assert.equal(raster.bitDepth, depth);
      assert.deepEqual(raster.getPixel(2, 1), pixels[5]);
      const roundTripped = Raster.fromPng(raster.toPng());
      assert.deepEqual(Array.from(roundTripped.data), pixels.flat());
    }
  });

  it('expands indexed-color PNGs', function () {
    const indexed = encode({
      width: 2,
      height: 1,
      channels: 1,
      depth: 8,
      data: new Uint8Array([0, 1]),
      palette: [
        [10, 20, 30],
        [40, 50, 60],
      ],
    });
    const rgb = Raster.fromPng(indexed);
    assert.equal(rgb.channels, 3);
    assert.deepEqual(Array.from(rgb.data), [10, 20, 30, 40, 50, 60]);

    const rgba = Raster.fromPng(withTransparency(indexed, [0, 200]));
    assert.equal(rgba.channels, 4);
    assert.deepEqual(Array.from(rgba.data), [10, 20, 30, 0, 40, 50, 60, 200]);
  });

  it('can crop', function () {
    const pixels = [...Array(12)].map((_, i) => [i, i, i, 255]);
    const raster = Raster.fromPng(png(4, 3, 4, 8, pixels));
    const cropped = raster.crop({ x: 1, y: 1, width: 2, height: 2 });
    assert.equal(cropped.width, 2);
    assert.equal(cropped.height, 2);
    assert.deepEqual(
      [0, 1, 2, 3].map((i) => cropped.getPixel(i % 2, Math.floor(i / 2))[0]),
      [5, 6, 9, 10],
    );
    assert.throws(() => raster.crop({ x: 3, y: 0, width: 2, height: 1 }));
  });

  it('can create and dilate alpha masks', function () {
    // prettier-ignore
    const raster = Raster.fromPng(png(4, 3, 2, 8, [
      [0, 0], [0, 0],   [0, 0], [0, 0],
      [0, 0], [0, 255], [0, 1], [0, 0],
      [0, 0], [0, 0],   [0, 0], [0, 0],
    ]));
    const lowThreshold = raster.alphaMask(1 / 256);
    assert.deepEqual(
      Array.from(lowThreshold.bits),
      [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    );
    const highThreshold = raster.alphaMask(0.5);
    assert.deepEqual(
      Array.from(highThreshold.bits),
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    );
    assert.deepEqual(
      Array.from(highThreshold.dilate().bits),
      [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
    );
    assert.equal(highThreshold.get(-1, 0), false);
    assert.equal(highThreshold.get(4, 1), false);
  });

  it('treats images without alpha as fully opaque', function () {
    const raster = Raster.fromPng(
      png(2, 1, 3, 8, [
        [0, 0, 0],
        [0, 0, 0],
      ]),
    );
    assert.deepEqual(Array.from(raster.alphaMask(0.5).bits), [1, 1]);
  });
});

describe('SpriteFrame transforms', function () {
  // prettier-ignore
  const sprite = png(5, 4, 4, 8, [
    T, T, T, T, T,
    T, R, T, T, T,
    T, T, R, [0, 0, 255, 3], T,
    T, T, T, T, T,
  ]);

  it('can compute bounding boxes', async function () {
    const frame = await frameFrom('bbox.png', sprite);
    assert.deepEqual(await frame.getBoundingBox(0), {
      left: 1,
      right: 3,
      top: 1,
      bottom: 2,
    });
    // Padding is clamped to the image bounds. (A new frame is
    // needed, since the bounding box is cached on first call.)
    const paddedFrame = await frameFrom('bbox-padded.png', sprite);
    assert.deepEqual(await paddedFrame.getBoundingBox(), {
      left: 0,
      right: 4,
      top: 0,
      bottom: 3,
    });
  });

  it('can crop', async function () {
    const frame = await frameFrom('crop.png', sprite);
    await frame.crop({ left: 1, right: 3, top: 1, bottom: 2 });
    const cropped = await rasterFrom(frame, 'crop.png');
    assert.equal(cropped.width, 3);
    assert.equal(cropped.height, 2);
    assert.deepEqual(cropped.getPixel(0, 0), R);
    assert.deepEqual(cropped.getPixel(2, 1), [0, 0, 255, 3]);
  });

  it('can bleed', async function () {
    // prettier-ignore
    const frame = await frameFrom('bleed.png', png(4, 3, 4, 8, [
      T, T, T, T,
      T, R, [0, 0, 255, 255], T,
      T, T, T, [0, 255, 0, 5],
    ]));
    await frame.bleed();
    const bled = await rasterFrom(frame, 'bleed.png');
    // Foreground is unchanged
    assert.deepEqual(bled.getPixel(1, 1), R);
    // Pixels touching only red become red with a low alpha
    assert.deepEqual(bled.getPixel(0, 0), [255, 0, 0, 6]);
    // Pixels touching red and blue get the average color
    assert.deepEqual(bled.getPixel(1, 0), [128, 0, 128, 6]);
    // Faint pixels below the bleed threshold are treated as background
    assert.deepEqual(bled.getPixel(3, 2), [0, 0, 255, 6]);
  });

  it('can bleed 16-bit images', async function () {
    const max = 65535;
    // prettier-ignore
    const frame = await frameFrom('bleed16.png', png(2, 1, 4, 16, [
      [max, 0, 0, max], [0, 0, 0, 0],
    ]));
    await frame.bleed();
    const bled = await rasterFrom(frame, 'bleed16.png');
    assert.equal(bled.bitDepth, 16);
    assert.deepEqual(bled.getPixel(1, 0), [max, 0, 0, Math.ceil(0.02 * 65536)]);
  });
});
