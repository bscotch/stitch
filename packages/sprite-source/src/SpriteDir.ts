import { Pathy, pathy } from '@bscotch/pathy';
import fsp from 'fs/promises';
import { SpriteFrame } from './SpriteFrame.js';
import { computeFilesChecksum } from './checksum.js';
import type { Issue, Log, SpriteSourceRootSummary } from './types.js';
import { assert } from './utility.js';

export class SpriteDir {
  protected _frames: SpriteFrame[] = [];
  protected _isSpine = false;
  protected _spinePaths: undefined | { atlas: Pathy; json: Pathy; png: Pathy };

  protected constructor(
    readonly path: Pathy,
    readonly logs: Log[],
    readonly issues: Issue[],
  ) {}

  get isSpine() {
    return this._isSpine;
  }

  get frames() {
    return [...this._frames];
  }

  get spinePaths() {
    assert(this.isSpine, 'Not a spine sprite');
    if (!this._spinePaths) {
      this._spinePaths = {
        atlas: this.path.join('skeleton.atlas'),
        json: this.path.join('skeleton.json'),
        png: this.path.join('skeleton.png'),
      };
    }
    return this._spinePaths;
  }

  async updateCache(cache: SpriteSourceRootSummary) {
    // Do some initial cleanup of the cache
    // Remove the cache if there has been a spine-type-change
    if (
      cache.info[this.path.relative] &&
      cache.info[this.path.relative].spine !== this.isSpine
    ) {
      delete cache.info[this.path.relative];
    }
    // Initialize the cache if it doesn't exist
    cache.info[this.path.relative] ||= this.isSpine
      ? {
          spine: true,
          changed: 0,
          checksum: '',
        }
      : {
          spine: false,
          frames: {},
        };
    const spriteCache = cache.info[this.path.relative];

    const waits: Promise<any>[] = [];
    if (spriteCache.spine) {
      // TODO: Handle the spine case
      const lastChanged = Math.max(
        ...(await Promise.all([
          this.spinePaths.atlas.stat().then(
            (s) => s.mtime.getTime(),
            () => 0,
          ),
          this.spinePaths.json.stat().then(
            (s) => s.mtime.getTime(),
            () => 0,
          ),
          this.spinePaths.png.stat().then(
            (s) => s.mtime.getTime(),
            () => 0,
          ),
        ])),
      );
      if (lastChanged !== spriteCache.changed || !spriteCache.checksum) {
        spriteCache.changed = lastChanged;
        spriteCache.checksum = await computeFilesChecksum([
          this.spinePaths.atlas.absolute,
          this.spinePaths.json.absolute,
          this.spinePaths.png.absolute,
        ]);
      }
    } else {
      for (const frame of this.frames) {
        waits.push(frame.updateCache(spriteCache));
      }
    }
    await Promise.all(waits);
  }

  async bleed() {
    if (this.isSpine) {
      return;
    }
    await Promise.all(this.frames.map((frame) => frame.bleed()));
  }

  async crop() {
    if (this.isSpine) {
      return;
    }
    // Get the boundingbox that captures the bounding boxes of
    // all frames.
    const bboxes = await Promise.all(
      this.frames.map((frame) => frame.getBoundingBox()),
    );
    const bbox = bboxes.slice(1).reduce((bbox, frameBbox) => {
      return {
        left: Math.min(bbox.left, frameBbox.left),
        right: Math.max(bbox.right, frameBbox.right),
        top: Math.min(bbox.top, frameBbox.top),
        bottom: Math.max(bbox.bottom, frameBbox.bottom),
      };
    }, bboxes[0]);
    // Crop all frames to that bounding box
    await Promise.all(this.frames.map((frame) => frame.crop(bbox)));
  }

  async moveTo(newSpriteDir: Pathy) {
    await newSpriteDir.ensureDirectory();
    if (this.isSpine) {
      const fromTo = [
        [this.spinePaths.atlas, newSpriteDir.join('skeleton.atlas')],
        [this.spinePaths.json, newSpriteDir.join('skeleton.json')],
        [this.spinePaths.png, newSpriteDir.join('skeleton.png')],
      ];
      await Promise.all(
        fromTo.map(([from, to]) =>
          from
            .copy(to)
            .then(() => from.delete({ retryDelay: 100, maxRetries: 5 })),
        ),
      );
      this.logs.push(
        ...fromTo.map(([from, to]) => ({
          action: 'moved' as const,
          path: from.absolute,
          to: to.absolute,
        })),
      );
    } else {
      const fromTo = this.frames.map((frame) => [
        frame.path,
        newSpriteDir.join(frame.path.basename),
      ]);
      await Promise.all(
        this.frames.map((frame) =>
          frame
            .saveTo(newSpriteDir.join(frame.path.basename))
            .then(() => frame.path.delete({ retryDelay: 100, maxRetries: 5 })),
        ),
      );
      this.logs.push(
        ...fromTo.map(([from, to]) => ({
          action: 'moved' as const,
          path: from.absolute,
          to: to.absolute,
        })),
      );
    }
    // Try to delete the folder
    try {
      await this.path.delete({
        recursive: true,
        retryDelay: 10,
        maxRetries: 5,
      });
    } catch (err) {
      this.issues.push({
        level: 'warning',
        message: `Could not delete source folder: ${this.path.relative}`,
        cause: err,
      });
    }
  }

  /**
   * If there are images in this directory, get a `SpriteDir`
   * instance. Else get `undefined`.
   */
  static async from(
    path: Pathy,
    logs: Log[],
    issues: Issue[],
  ): Promise<SpriteDir | undefined> {
    const files = (await fsp.readdir(path.absolute)).map((file) =>
      pathy(file, path.absolute),
    );
    const pngs = files.filter((file) => file.basename.match(/\.png$/i));
    pngs.sort();
    if (pngs.length === 0) {
      return;
    }

    const sprite = new SpriteDir(path, logs, issues);
    const isSpine = !!files.find((f) => f.basename === 'skeleton.atlas');
    if (isSpine) {
      sprite._isSpine = true;
      const existance = await Promise.all([
        sprite.spinePaths.json.exists(),
        sprite.spinePaths.png.exists(),
      ]);
      assert(
        existance.every((x) => x),
        'Invalid spine sprite.',
      );
    } else {
      sprite._frames = pngs.map((png) => new SpriteFrame(png));
      // TODO: Make sure all frames are the same size
      const expectedSize = await sprite.frames[0].getSize();
      for (const frame of sprite.frames.slice(1)) {
        const size = await frame.getSize();
        assert(
          size.width === expectedSize.width &&
            size.height === expectedSize.height,
          'Frames must all be the same size.',
        );
      }
    }

    return sprite;
  }

  toJSON() {
    return {
      path: this.path,
      isSpine: this.isSpine,
      framePaths: this.frames,
    };
  }
}
