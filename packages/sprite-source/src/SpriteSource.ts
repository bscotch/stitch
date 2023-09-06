import { Pathy, pathy } from '@bscotch/pathy';
import { SpriteDir } from './SpriteDir.js';
import { SpriteSourcePaths, getSpriteSourcePaths } from './paths.js';
import {
  Issue,
  Log,
  SpriteSourceRootSummary,
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
  rethrow,
} from './utility.js';

export class SpriteSource {
  readonly issues: Issue[] = [];
  readonly paths: SpriteSourcePaths;
  readonly logs: Log[] = [];

  constructor(readonly sourceDirPath: string | Pathy) {
    this.paths = getSpriteSourcePaths(sourceDirPath);
  }

  protected async getSpriteDirs(dirs: Pathy[]): Promise<SpriteDir[]> {
    const waits: Promise<any>[] = [];
    const spriteDirs: SpriteDir[] = [];
    for (const dir of dirs) {
      waits.push(
        SpriteDir.from(dir, this.logs, this.issues)
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
    // Identify all "SpriteDirs". Stored as a set so we
    // can remove the ones we process.
    const spriteDirs = new Set(
      await this.getSpriteDirs(await getDirs(dir.absolute)),
    );

    for (const transform of staging.transforms) {
      // filter to matching sprites
      const pattern = transform.include
        ? new RegExp(transform.include)
        : undefined;
      const sprites: SpriteDir[] = [];
      for (const sprite of spriteDirs) {
        if (!pattern || sprite.path.relative.match(pattern)) {
          sprites.push(sprite);
          spriteDirs.delete(sprite);
        }
      }

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
                this.logs.push(
                  ...deleted.map((path) => ({
                    action: 'deleted' as const,
                    path: path.absolute,
                  })),
                );
              })
            : Promise.resolve(),
        );
        // Save to destination (including renames)
        const moveWait = deleteWait.then(() => sprite.moveTo(outDir));
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

  protected async loadCache(): Promise<SpriteSourceRootSummary> {
    let cache: SpriteSourceRootSummary;
    try {
      cache = await this.paths.cache.read({
        fallback: {},
      });
    } catch (err) {
      cache = {
        info: {},
      };
      this.issues.push({
        level: 'warning',
        message: `Could not load sprite cache. Will rebuild from scratch.`,
        cause: err,
      });
    }
    return cache;
  }

  /**
   * Update the sprite-info cache.
   */
  protected async updateSpriteInfo(ignore: string[] | null | undefined) {
    const ignorePatterns = ignore?.map((pattern) => new RegExp(pattern));
    // Load the current cache and sprite dirs
    const [cache, allSpriteDirs] = await Promise.all([
      this.loadCache(),
      getDirs(this.paths.root.absolute).then((dirs) =>
        this.getSpriteDirs(dirs),
      ),
    ]);
    // Filter out ignored spriteDirs
    const spriteDirs = !ignore?.length
      ? allSpriteDirs
      : allSpriteDirs.filter(
          (dir) =>
            !ignorePatterns?.some((pattern) =>
              dir.path.relative.match(pattern),
            ),
        );

    // For each sprite, update the cache with its size, frames (checksums, changedAt, etc)
    const waits: Promise<any>[] = [];
    for (const sprite of spriteDirs) {
      waits.push(sprite.updateCache(cache));
    }
    await Promise.all(waits);

    // Remove any sprite info that no longer exists
    const existingSpriteDirs = new Set(
      spriteDirs.map((dir) => dir.path.relative),
    );
    for (const spriteDir of Object.keys(cache.info)) {
      if (!existingSpriteDirs.has(spriteDir)) {
        delete cache.info[spriteDir];
      }
    }

    // Save and return the updated cache
    await this.paths.cache.write(cache);
    return cache;
  }

  /**
   * Transform any staged sprites and add them to the source,
   * and compute updated sprite info.
   */
  async update(
    /** Optionally override config options */
    options: SpriteSourceConfig,
  ) {
    const start = Date.now();

    // Reset issues
    this.issues.length = 0;

    const config = await this.loadConfig(options);

    // Process any staging folders
    for (const staging of config.staging ?? []) {
      // Do them sequentially since later patterns could overlap earlier ones
      await this.resolveStaged(staging);
    }

    // Update the sprite info cache
    await this.updateSpriteInfo(config.ignore);

    console.log(`Imported from sprite source in ${Date.now() - start}ms`);
  }
}
