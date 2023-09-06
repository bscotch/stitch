import { Pathy, pathy } from '@bscotch/pathy';
import fsp from 'fs/promises';
import { Image } from 'image-js';
import { SpriteSourcePaths, getSpriteSourcePaths } from './paths.js';
import {
  SpriteStaging,
  spriteSourceConfigSchema,
  type SpriteSourceConfig,
} from './types.js';
import {
  AnyFunc,
  AsyncableChecked,
  assert,
  check,
  deletePngChildren,
  getDirs,
  getPngSize,
  rethrow,
  sequential,
} from './utility.js';

interface Issue {
  level: 'error' | 'warning';
  message: string;
  cause?: any;
}

interface Log {
  action: 'deleted' | 'moved';
  path: Pathy;
  to?: Pathy;
}

export interface BBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export class SpriteFrame {
  protected _size: undefined | { width: number; height: number };
  protected _bbox: undefined | BBox;
  protected _image: undefined | Image;
  protected _masks: { [minAlpha: string]: Image } = {};

  constructor(readonly path: Pathy) {}

  protected clearCache() {
    this._size = undefined;
    this._bbox = undefined;
    this._image = undefined;
    this._masks = {};
  }

  @sequential
  async getImage() {
    if (this._image) {
      return this._image;
    }
    this._image = await Image.load(this.path.absolute);
    return this._image;
  }

  @sequential
  async getSize() {
    if (this._size) {
      return { ...this._size };
    }
    this._size = await getPngSize(this.path);
    return this._size;
  }

  @sequential
  async getForegroundMask(foregroundMinAlphaFraction?: number) {
    const alphaKey = `${foregroundMinAlphaFraction}`;
    if (this._masks[alphaKey]) {
      return this._masks[alphaKey];
    }
    const image = await this.getImage();
    const threshold =
      foregroundMinAlphaFraction || 1 / Math.pow(2, image.bitDepth);
    this._masks[alphaKey] = image
      .getChannel(image.channels - 1)
      .mask({ threshold });
    return this._masks[alphaKey];
  }

  @sequential
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
    this._bbox = {
      left: left == Infinity ? 0 : left,
      right: right == -Infinity ? foreground.width - 1 : right,
      top: top == Infinity ? 0 : top,
      bottom: bottom == -Infinity ? foreground.height - 1 : bottom,
    };
    return { ...this._bbox };
  }

  @sequential
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

  @sequential
  async bleed() {
    const img = await this.getImage();
    if (!img.alpha) {
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
    const expandedForeground = foreground.dilate({
      kernel: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
    });

    const isInForeground = (x: number, y: number) => foreground.getBitXY(x, y);
    const isInExpandedForeground = (x: number, y: number) =>
      expandedForeground.getBitXY(x, y);
    const isInOutline = (x: number, y: number) =>
      isInExpandedForeground(x, y) && !isInForeground(x, y);

    // There does not seem to be a way to combine masks in image-js,
    // but we don't really need to for the desired outcome.
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
                neighbors.push(img.getPixelXY(ax, ay));
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
            img.setPixelXY(x, y, newColor);
          }
        }
      }
    }
    this.clearCache();
    this._image = img;
  }

  @sequential
  async saveTo(path: Pathy) {
    const image = await this.getImage();
    await image.save(path.absolute);
  }
}

export class SpriteDir {
  protected _frames: SpriteFrame[] = [];
  protected _isSpine = false;
  protected _spinePaths: undefined | { atlas: Pathy; json: Pathy; png: Pathy };

  protected constructor(
    readonly path: Pathy,
    readonly log: Log[],
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

  async saveTo(dir: Pathy) {
    await dir.ensureDirectory();
    if (this.isSpine) {
      const fromTo = [
        [this.spinePaths.atlas, dir.join('skeleton.atlas')],
        [this.spinePaths.json, dir.join('skeleton.json')],
        [this.spinePaths.png, dir.join('skeleton.png')],
      ];
      await Promise.all(
        fromTo.map(([from, to]) =>
          from
            .copy(to)
            .then(() => from.delete({ retryDelay: 100, maxRetries: 5 })),
        ),
      );
      this.log.push(
        ...fromTo.map(([from, to]) => ({
          action: 'moved' as const,
          path: from,
          to: to,
        })),
      );
    } else {
      const fromTo = this.frames.map((frame) => [
        frame.path,
        dir.join(frame.path.basename),
      ]);
      await Promise.all(
        this.frames.map((frame) =>
          frame
            .saveTo(dir.join(frame.path.basename))
            .then(() => frame.path.delete({ retryDelay: 100, maxRetries: 5 })),
        ),
      );
      this.log.push(
        ...fromTo.map(([from, to]) => ({
          action: 'moved' as const,
          path: from,
          to: to,
        })),
      );
    }
  }

  /**
   * If there are images in this directory, get a `SpriteDir`
   * instance. Else get `undefined`.
   */
  static async from(path: Pathy, log: Log[]): Promise<SpriteDir | undefined> {
    const files = (await fsp.readdir(path.absolute)).map((file) =>
      pathy(file, path.absolute),
    );
    const pngs = files.filter((file) => file.basename.match(/\.png$/i));
    pngs.sort();
    if (pngs.length === 0) {
      return;
    }

    const sprite = new SpriteDir(path, log);
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

export class SpriteSource {
  readonly issues: Issue[] = [];
  readonly paths: SpriteSourcePaths;
  readonly log: Log[] = [];

  constructor(readonly sourceDirPath: string | Pathy) {
    this.paths = getSpriteSourcePaths(sourceDirPath);
  }

  protected async getSpriteDirs(dirs: Pathy[]): Promise<SpriteDir[]> {
    const waits: Promise<any>[] = [];
    const spriteDirs: SpriteDir[] = [];
    for (const dir of dirs) {
      waits.push(
        SpriteDir.from(dir, this.log)
          .then((sprite) => {
            if (sprite) {
              spriteDirs.push(sprite);
            }
          })
          .catch((err) => {
            this.issues.push({
              level: 'error',
              message: `Error processing "${dir.relative}"`,
              cause: err,
            });
          }),
      );
    }
    await Promise.all(waits);
    return spriteDirs;
  }

  protected async resolveStaged(staging: SpriteStaging) {
    const dir = this.paths.root.join(staging.dir);
    if (!(await dir.exists())) {
      this.issues.push({
        level: 'warning',
        message: `Staging directory does not exist: ${dir}`,
      });
      return;
    }
    // Identify all "SpriteDirs"
    const spriteDirs = await this.getSpriteDirs(await getDirs(dir.absolute));

    for (const transform of staging.transforms) {
      // filter to matching sprites
      const pattern = transform.include
        ? new RegExp(transform.include)
        : undefined;
      const sprites = pattern
        ? spriteDirs.filter((sprite) => sprite.path.relative.match(pattern))
        : spriteDirs;

      const waits: Promise<any>[] = [];
      for (const sprite of sprites) {
        let outDirPath = sprite.path.relative;
        if (transform.renames) {
          for (const rename of transform.renames) {
            outDirPath = outDirPath.replace(new RegExp(rename.from), rename.to);
          }
        }
        const outDir = pathy(outDirPath, this.paths.root);
        // Crop it!
        const cropWait = transform.crop ? sprite.crop() : Promise.resolve();
        // Bleed it!
        const bleedWait = cropWait.then(() =>
          transform.bleed ? sprite.bleed() : Promise.resolve(),
        );
        // Purge the output location!
        const deleteWait = bleedWait.then(() =>
          transform.synced
            ? deletePngChildren(outDir).then((deleted) => {
                this.log.push(
                  ...deleted.map((path) => ({
                    action: 'deleted' as const,
                    path,
                  })),
                );
              })
            : Promise.resolve(),
        );
        // Save to destination (including renames)
        const moveWait = deleteWait.then(() => sprite.saveTo(outDir));
        waits.push(moveWait);
      }
      await Promise.allSettled(waits);
    }
  }

  protected check<T extends AnyFunc>(
    func: T,
    message: string,
  ): AsyncableChecked<T> {
    const results = check(func, message);
    if (results instanceof Promise) {
      void results.then(([error, result]) => {
        if (error) {
          this.issues.push({ level: 'error', message, cause: error });
        }
        return [error, result];
      });
    }
    return results;
  }

  protected async loadConfig(
    overrides: SpriteSourceConfig,
  ): Promise<SpriteSourceConfig> {
    // Validate options. Show error out if invalid.
    try {
      overrides = spriteSourceConfigSchema.parse(overrides);
    } catch (err) {
      rethrow(err, 'Invalid SpriteSource options');
    }
    const paths = getSpriteSourcePaths(this.sourceDirPath);
    assert(
      await paths.root.isDirectory(),
      'Source must be an existing directory.',
    );
    // Update the config
    await paths.stitch.ensureDirectory();
    const config = await paths.config.read({ fallback: {} });
    if (overrides.ignore !== undefined) {
      config.ignore = overrides.ignore;
    }
    if (overrides.staging !== undefined) {
      config.staging = overrides.staging;
    }
    await paths.config.write(config);
    return config;
  }

  async import(
    targetProject: string | Pathy,
    /** Optionally override config options */
    options: SpriteSourceConfig,
  ) {
    const start = Date.now();
    const project = pathy(targetProject);

    // Reset issues
    this.issues.length = 0;

    assert(
      project.hasExtension('yyp') && (await project.exists()),
      'Target must be an existing .yy file.',
    );

    const config = await this.loadConfig(options);

    // Process any staging folders
    for (const staging of config.staging ?? []) {
      // Do them sequentially since later patterns could overlap earlier ones
      await this.resolveStaged(staging);
    }

    console.log(`Imported from sprite source in ${Date.now() - start}ms`);
  }
}
