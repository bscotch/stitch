import { memoize, MemoizedClass } from '@bscotch/utility';
import fse from 'fs-extra';
import { Image } from 'image-js';
import { assert, ErrorCodes } from './errors.js';
import { SpritelyStatic } from './Spritely.static.js';
import { ImageExt, SpritelyBoundingBox } from './Spritely.types.js';

export interface SpritelySubimage extends MemoizedClass {}

@memoize
export class SpritelySubimage {
  constructor(readonly path: string) {}

  get width() {
    return this.size().width;
  }

  get height() {
    return this.size().height;
  }

  existsSync() {
    return fse.pathExistsSync(this.path);
  }

  async exists() {
    return await fse.pathExists(this.path);
  }

  @memoize
  async checksum() {
    return await SpritelyStatic.pixelsChecksum(this.path);
  }

  async load(): Promise<ImageExt> {
    return (await Image.load(this.path)) as ImageExt;
  }

  @memoize
  size(options?: { expected?: { width: number; height: number } }): {
    width: number;
    height: number;
  } {
    const size = SpritelyStatic.getImageSizeSync(this.path);
    if (!options?.expected) {
      return size;
    }
    assert(
      size.width === options.expected.width,
      `Subimage '${this.path}' has width ${size.width}; expected ${options.expected.width}`,
      ErrorCodes.sizeMismatch,
    );
    assert(
      size.height === options.expected.height,
      `Subimage '${this.path}' has height ${size.height}; expected ${options.expected.height}`,
      ErrorCodes.sizeMismatch,
    );
    return size;
  }

  async crop(boundingBox?: SpritelyBoundingBox, padding = 0) {
    const bbox = boundingBox || (await this.boundingBox(padding));
    const img = await this.load();
    const cropBox = SpritelyStatic.cropObjectFromBoundingBox(bbox);
    await img.crop(cropBox).save(this.path);
    this.clearMemoized();
  }

  @memoize
  async boundingBox(padding = 0): Promise<SpritelyBoundingBox> {
    const foreground = SpritelyStatic.getForegroundMask(await this.load());
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let x = 0; x < foreground.width; x++) {
      for (let y = 0; y < foreground.height; y++) {
        if (foreground.getBitXY(x, y)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    padding = Math.round(padding);
    if (padding > 0) {
      top = Math.max(top - padding, 0);
      left = Math.max(left - padding, 0);
      right = Math.min(right + padding, foreground.width - 1);
      bottom = Math.min(bottom + padding, foreground.height - 1);
    }
    return {
      left: left == Infinity ? 0 : left,
      right: right == -Infinity ? foreground.width - 1 : right,
      top: top == Infinity ? 0 : top,
      bottom: bottom == -Infinity ? foreground.height - 1 : bottom,
    };
  }

  async equals(other: SpritelySubimage | string) {
    other = typeof other === 'string' ? new SpritelySubimage(other) : other;
    assert(
      other instanceof SpritelySubimage,
      'other must be a SpritelySubimage or path to an image',
    );
    const checksums = await Promise.all([this.checksum(), other.checksum()]);
    return checksums[0] === checksums[1];
  }
}
