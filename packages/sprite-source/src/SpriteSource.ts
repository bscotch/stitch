import { Pathy, pathy } from '@bscotch/pathy';
import fsp from 'fs/promises';
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
  getDirs,
  getPngSize,
  rethrow,
} from './utility.js';

interface Issue {
  kind: 'error' | 'warning';
  message: string;
  cause?: any;
}

export class SpriteDir {
  protected _framePaths: Pathy[] = [];
  protected _isSpine = false;
  protected _spinePaths: undefined | { atlas: Pathy; json: Pathy; png: Pathy };
  protected _width: undefined | number;
  protected _height: undefined | number;

  protected constructor(readonly path: Pathy) {}

  get width() {
    assert(!this.isSpine, 'Not a sprite');
    assert(this._width, 'Width not set');
    return this._width;
  }

  get height() {
    assert(!this.isSpine, 'Not a sprite');
    assert(this._height, 'Height not set');
    return this._height;
  }

  get isSpine() {
    return this._isSpine;
  }

  get framePaths() {
    return [...this._framePaths];
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

  /**
   * If there are images in this directory, get a `SpriteDir`
   * instance. Else get `undefined`.
   */
  static async from(path: Pathy): Promise<SpriteDir | undefined> {
    const files = (await fsp.readdir(path.absolute)).map((file) =>
      pathy(file, path.absolute),
    );
    const pngs = files.filter((file) => file.basename.match(/\.png$/i));
    pngs.sort();
    if (pngs.length === 0) {
      return;
    }

    const sprite = new SpriteDir(path);
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
      sprite._framePaths = pngs;
      // TODO: Make sure all frames are the same size
      const expectedSize = await getPngSize(pngs[0]);
      for (const png of pngs.slice(1)) {
        const size = await getPngSize(png);
        assert(
          size.width === expectedSize.width &&
            size.height === expectedSize.height,
          'Frames must all be the same size.',
        );
      }
      sprite._width = expectedSize.width;
      sprite._height = expectedSize.height;
    }

    return sprite;
  }

  toJSON() {
    return {
      path: this.path,
      isSpine: this.isSpine,
      framePaths: this.framePaths,
    };
  }
}

export class SpriteSource {
  readonly issues: Issue[] = [];
  readonly paths: SpriteSourcePaths;

  constructor(readonly sourceDirPath: string | Pathy) {
    this.paths = getSpriteSourcePaths(sourceDirPath);
  }

  protected async getSpriteDirs(dirs: Pathy[]): Promise<SpriteDir[]> {
    const waits: Promise<any>[] = [];
    const spriteDirs: SpriteDir[] = [];
    for (const dir of dirs) {
      waits.push(
        SpriteDir.from(dir)
          .then((sprite) => {
            if (sprite) {
              spriteDirs.push(sprite);
            }
          })
          .catch((err) => {
            this.issues.push({
              kind: 'error',
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
        kind: 'warning',
        message: `Staging directory does not exist: ${dir}`,
      });
      return;
    }
    // Identify all "SpriteDirs"
    const spriteDirs = await this.getSpriteDirs(await getDirs(dir.absolute));

    // TODO: For each transform
    for (const transform of staging.transforms) {
      // filter to matching sprites
      const pattern = transform.include
        ? new RegExp(transform.include)
        : undefined;
      const sprites = pattern
        ? spriteDirs.filter((sprite) => sprite.path.relative.match(pattern))
        : spriteDirs;

      if (transform.bleed) {
        // TODO: Handle bleed
      }
      if (transform.crop) {
        // TODO: Handle crop
      }

      // TODO: Determine target location

      if (transform.synced) {
        // TODO: Delete files in target
      }
      // TODO: Handle move (including renames)
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
          this.issues.push({ kind: 'error', message, cause: error });
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
