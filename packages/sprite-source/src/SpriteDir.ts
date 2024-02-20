import { Pathy, pathy, statSafe } from '@bscotch/pathy';
import { Yy } from '@bscotch/yy';
import type { SpritesInfo } from './SpriteCache.schemas.js';
import { SpriteFrame } from './SpriteFrame.js';
import { computeFilesChecksum, computeStringChecksum } from './checksum.js';
import { retryOptions } from './constants.js';
import { readdirSafe } from './safeFs.js';
import type { Log } from './types.js';
import { SpriteSourceError, assert } from './utility.js';

export class SpriteDir {
  protected _frames: SpriteFrame[] = [];
  protected _isSpine = false;
  protected _spinePaths:
    | undefined
    | { atlas: Pathy; json: Pathy; pngs: Pathy[] };

  protected constructor(
    readonly path: Pathy,
    readonly logs: Log[],
    readonly issues: Error[],
  ) {}

  get isSpine() {
    return this._isSpine;
  }

  get frames() {
    return [...this._frames];
  }

  get spinePaths() {
    assert(this.isSpine, 'Not a spine sprite');
    return { ...this._spinePaths! };
  }

  async updateCache(cache: SpritesInfo) {
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
          checksum: '',
        };
    const spriteCache = cache.info[this.path.relative];

    const frameWaits: Promise<{ checksum: string }>[] = [];
    if (spriteCache.spine) {
      // Handle the spine case
      const pngs = [...this.spinePaths.pngs];
      pngs.sort((a, b) => a.basename.localeCompare(b.basename, 'en-US'));
      const lastChanged = Math.max(
        ...(await Promise.all([
          statSafe(this.spinePaths.atlas, retryOptions).then(
            (s) => s.mtime.getTime(),
            () => 0,
          ),
          statSafe(this.spinePaths.json, retryOptions).then(
            (s) => s.mtime.getTime(),
            () => 0,
          ),
          ...pngs.map((png) =>
            statSafe(png, retryOptions).then(
              (s) => s.mtime.getTime(),
              () => 0,
            ),
          ),
        ])),
      );
      if (lastChanged !== spriteCache.changed || !spriteCache.checksum) {
        spriteCache.changed = lastChanged;
        spriteCache.checksum = await computeFilesChecksum([
          this.spinePaths.atlas.absolute,
          this.spinePaths.json.absolute,
          ...pngs.map((p) => p.absolute),
        ]);
      }
    } else {
      // Remove any frames that no longer exist
      const excessFrames = new Set(Object.keys(spriteCache.frames));
      for (const frame of this.frames) {
        excessFrames.delete(frame.path.relative);
        frameWaits.push(frame.updateCache(spriteCache));
      }
      for (const frame of excessFrames) {
        delete spriteCache.frames[frame];
      }
    }
    const frames = await Promise.all(frameWaits);
    if (!spriteCache.spine) {
      // Sort the checksums by checksum since filenames will change between
      // source and dest. Creates a problem if frame *order* changes, so we
      // may need to deal with that later.
      const frameChecksums = frames.map((f) => f.checksum).sort();
      spriteCache.checksum = computeStringChecksum(frameChecksums.join('-'));
    }
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
        [
          this.spinePaths.atlas,
          newSpriteDir.join(this.spinePaths.atlas.basename),
        ],
        [
          this.spinePaths.json,
          newSpriteDir.join(this.spinePaths.json.basename),
        ],
        ...this.spinePaths.pngs.map((png) => [
          png,
          newSpriteDir.join(png.basename),
        ]),
      ];
      await Promise.all(
        fromTo.map(([from, to]) =>
          from.copy(to).then(() =>
            from.delete({
              ...retryOptions,
              force: true,
            }),
          ),
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
          frame.saveTo(newSpriteDir.join(frame.path.basename)).then(() =>
            frame.path.delete({
              ...retryOptions,
              force: true,
            }),
          ),
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
        ...retryOptions,
        force: true,
      });
    } catch (err) {
      this.issues.push(
        new SpriteSourceError(
          `Could not delete source folder: ${this.path.relative}`,
          err,
        ),
      );
    }
  }

  /**
   * If there are images in this directory, get a `SpriteDir`
   * instance. Else get `undefined`.
   */
  static async from(
    path: Pathy,
    logs: Log[] = [],
    issues: Error[] = [],
  ): Promise<SpriteDir | undefined> {
    const files = (await readdirSafe(path.absolute)).map((file) =>
      pathy(file, path.absolute),
    );
    let pngs = files.filter((file) => file.basename.match(/\.png$/i));
    pngs.sort();
    if (pngs.length === 0) {
      return;
    }

    const sprite = new SpriteDir(path, logs, issues);
    const hasAtlas = !!files.find((f) => f.hasExtension('atlas'));
    if (hasAtlas) {
      sprite._isSpine = true;
      // Then it's either a spine export or a spine sprite folder in GameMaker
      // If it's a spine export, all files will be named "{exportName}.*"
      // If it's a GameMaker spine sprite, there will be a "{exportName}.png",
      // but the other files will be named "{GUID}.*". If there are multiple
      // identifiers (due to incomplete cleanup of a previous import), we'll
      // have to open the yy file to determine the correct GUID.

      // 1. See if we have multiple {name}.atlas files. If so, use the yy file (if there is one) to determine the correct GUID.
      const atlasFiles = files.filter((f) => f.hasExtension('atlas'));
      let frameId = atlasFiles[0].name;
      if (atlasFiles.length > 1) {
        const yyFiles = files.filter((f) => f.hasExtension('yy'));
        assert(
          yyFiles.length === 1,
          'Multiple .atlas files found in a single folder. There must be exactly one .yy file in this folder to determine the correct GUID.',
        );
        const yyFile = yyFiles[0];
        const yy = await Yy.read(yyFile.absolute, 'sprites');
        frameId = yy.frames[0]?.name;
        assert(
          frameId,
          `No GUID found in yy file. Cannot determine which .atlas file to use for ${path.relative}`,
        );
      }

      // 2. Get the {name}.atlas and {name}.json files
      const skeletonJson = files.find(
        (f) => f.name === frameId && f.hasExtension('json'),
      );
      const skeletonAtlas = files.find(
        (f) => f.name === frameId && f.hasExtension('atlas'),
      );
      assert(
        skeletonJson,
        `No .json file found for ${path.relative}/${frameId}`,
      );
      assert(
        skeletonAtlas,
        `No .atlas file found for ${path.relative}/${frameId}`,
      );

      // 3. Set the spine paths. There can be multiple PNGs, and in the case
      //    of GameMaker assets there can be *other* PNGs (like thumbnails).
      //    So we need to read the atlas file to determine which PNGs are
      //    the ones we want.
      const atlasContent = (await skeletonAtlas.read({
        encoding: 'utf8',
      })) as string;
      const pngNames = atlasContent.match(/^.*\.png$/gm);
      pngs = pngs.filter((png) => pngNames?.includes(png.basename));
      assert(pngs.length > 0, 'No PNGs found in atlas file.');
      sprite._spinePaths = {
        atlas: skeletonAtlas,
        json: skeletonJson,
        pngs,
      };
    } else {
      sprite._frames = pngs.map((png) => new SpriteFrame(png));
      // Make sure all frames are the same size
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
