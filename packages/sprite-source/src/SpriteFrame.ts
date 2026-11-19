import { __decorate } from 'tslib';
import { type Pathy, statSafe } from '@bscotch/pathy';
import { sequential } from '@bscotch/utility';
import { readFile, writeFile } from 'node:fs/promises';
import type { SpriteSummary } from './SpriteCache.schemas.ts';
import { retryOptions } from './constants.ts';
import type { BBox } from './types.ts';
import { type Mask, Raster } from './raster.ts';
import { getPngSize } from './utility.ts';

export class SpriteFrame {
  protected _size: undefined | { width: number; height: number };
  protected _bbox: undefined | BBox;
  protected _image: undefined | Raster;
  protected _masks: { [minAlpha: string]: Mask } = {};
  protected _checksum: undefined | string;

  readonly path: Pathy;

  constructor(path: Pathy) {
    this.path = path;
  }

  protected clearCache() {
    this._size = undefined;
    this._bbox = undefined;
    this._image = undefined;
    this._checksum = undefined;
    this._masks = {};
  }

  async updateCache(cache: SpriteSummary) {
    const lastChanged = (
      await statSafe(this.path, retryOptions)
    ).mtime.getTime();
    const needsUpdate =
      (cache.frames[this.path.relative]?.changed || 0) !== lastChanged;
    if (!needsUpdate) return cache.frames[this.path.relative];
    const [size] = await Promise.all([this.getSize()]);
    cache.frames[this.path.relative] = {
      changed: lastChanged,
      checksum: '', // To be batch-computed later
      height: size.height,
      width: size.width,
    };
    return cache.frames[this.path.relative];
  }

  async getImage() {
    if (this._image) {
      return this._image;
    }
    this._image = Raster.fromPng(await readFile(this.path.absolute));
    return this._image;
  }

  async getSize() {
    if (this._size) {
      return { ...this._size };
    }
    this._size = await getPngSize(this.path);
    return this._size;
  }

  async getForegroundMask(foregroundMinAlphaFraction?: number) {
    const alphaKey = `${foregroundMinAlphaFraction}`;
    if (this._masks[alphaKey]) {
      return this._masks[alphaKey];
    }
    const image = await this.getImage();
    const threshold =
      foregroundMinAlphaFraction || 1 / Math.pow(2, image.bitDepth);
    this._masks[alphaKey] = image.alphaMask(threshold);
    return this._masks[alphaKey];
  }

  async getBoundingBox(padding = 1): Promise<BBox> {
    if (this._bbox) {
      return { ...this._bbox };
    }
    const foreground = await this.getForegroundMask();
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let x = 0; x < foreground.width; x++) {
      for (let y = 0; y < foreground.height; y++) {
        if (foreground.get(x, y)) {
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
    this._bbox = {
      left: left == Infinity ? 0 : left,
      right: right == -Infinity ? foreground.width - 1 : right,
      top: top == Infinity ? 0 : top,
      bottom: bottom == -Infinity ? foreground.height - 1 : bottom,
    };
    return { ...this._bbox };
  }

  async crop(bbox: BBox) {
    const img = await this.getImage();
    const cropBox = {
      x: bbox.left,
      y: bbox.top,
      width: bbox.right - bbox.left + 1,
      height: bbox.bottom - bbox.top + 1,
    };
    this.clearCache();
    this._image = img.crop(cropBox);
  }

  async bleed() {
    const img = await this.getImage();
    if (!img.hasAlpha) {
      return;
    }
    const maxPixelValue = Math.pow(2, img.bitDepth);
    const bleedMaxAlpha = Math.ceil(0.02 * maxPixelValue);
    const transparentBlackPixel = [...Array(img.channels)].map(() => 0);
    // Create a mask from the background (alpha zero) and then erode it by a few pixels.
    // Add a mask from the foreground (alpha > 0)
    // Invert to get the background pixels that need to be adjusted
    // Set the color of those pixels to the the color of the nearest foreground, and the alpha
    // to something very low so that it mostly isn't visible but won't be treated as background downstream
    const foreground = await this.getForegroundMask(
      (bleedMaxAlpha + 1) / maxPixelValue,
    );
    const expandedForeground = foreground.dilate();

    const isInForeground = (x: number, y: number) => foreground.get(x, y);
    const isInExpandedForeground = (x: number, y: number) =>
      expandedForeground.get(x, y);
    const isInOutline = (x: number, y: number) =>
      isInExpandedForeground(x, y) && !isInForeground(x, y);

    // Iterate over all pixels. Those in the expanded foreground but not in the foreground
    // should be set in the original image based on nearby non-background pixels
    for (let x = 0; x < img.width; x++) {
      for (let y = 0; y < img.height; y++) {
        if (isInOutline(x, y)) {
          const neighbors = [];
          for (let ax = x - 1; ax <= x + 1; ax++) {
            for (let ay = y - 1; ay <= y + 1; ay++) {
              if (ax == x && ay == y) {
                continue;
              }
              if (isInForeground(ax, ay)) {
                neighbors.push(img.getPixel(ax, ay));
              }
            }
          }
          if (neighbors.length) {
            // average the colors
            const colorSamples: number[][] = transparentBlackPixel.map(
              () => [],
            );
            for (const neighbor of neighbors) {
              for (let channel = 0; channel < img.channels; channel++) {
                colorSamples[channel].push(neighbor[channel]);
              }
            }
            const newColor = colorSamples.map((sample, idx) => {
              if (idx == img.channels - 1) {
                // Alpha should be 2% or half the min neighboring alpha
                const minAlpha = sample.reduce(
                  (min, value) => Math.min(min, value),
                  Infinity,
                );
                return Math.ceil(Math.min(minAlpha * 0.5, bleedMaxAlpha));
              } else {
                // Use the average color
                return Math.round(
                  sample.reduce((sum, value) => sum + value, 0) / sample.length,
                );
              }
            });
            img.setPixel(x, y, newColor);
          }
        }
      }
    }
    this.clearCache();
    this._image = img;
  }

  async saveTo(path: Pathy) {
    const image = await this.getImage();
    await writeFile(path.absolute, image.toPng());
  }
}

// Node can't run decorator syntax, so apply them explicitly
__decorate([sequential], SpriteFrame.prototype, 'getImage', null);
__decorate([sequential], SpriteFrame.prototype, 'getSize', null);
__decorate([sequential], SpriteFrame.prototype, 'getForegroundMask', null);
__decorate([sequential], SpriteFrame.prototype, 'getBoundingBox', null);
__decorate([sequential], SpriteFrame.prototype, 'crop', null);
__decorate([sequential], SpriteFrame.prototype, 'bleed', null);
__decorate([sequential], SpriteFrame.prototype, 'saveTo', null);
