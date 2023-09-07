import { Pathy, pathy } from '@bscotch/pathy';
import { SpriteCache } from './SpriteCache.js';
import { SpriteDir } from './SpriteDir.js';
import {
  spriteSourceConfigSchema,
  type SpriteSourceConfig,
  type SpriteStaging,
} from './SpriteSource.schemas.js';
import { assert, deletePngChildren, getDirs, rethrow } from './utility.js';

export class SpriteSource extends SpriteCache {
  get configFile() {
    return this.stitchDir
      .join('sprites.config.json')
      .withValidator(spriteSourceConfigSchema);
  }

  protected async resolveStaged(staging: SpriteStaging) {
    const dir = this.spritesRoot.join(staging.dir);
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
        const outDir = pathy(outDirPath, this.spritesRoot);
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

  protected async loadConfig(
    overrides: SpriteSourceConfig = {},
  ): Promise<SpriteSourceConfig> {
    // Validate options. Show error out if invalid.
    try {
      overrides = spriteSourceConfigSchema.parse(overrides);
    } catch (err) {
      rethrow(err, 'Invalid SpriteSource options');
    }
    assert(
      await this.spritesRoot.isDirectory(),
      'Source must be an existing directory.',
    );
    // Update the config
    await this.stitchDir.ensureDirectory();
    const config = await this.configFile.read({ fallback: {} });
    if (overrides?.ignore !== undefined) {
      config.ignore = overrides.ignore;
    }
    if (overrides?.staging !== undefined) {
      config.staging = overrides.staging;
    }
    await this.configFile.write(config);
    return config;
  }

  /**
   * Transform any staged sprites and add them to the source,
   * and compute updated sprite info.
   */
  async update(
    /** Optionally override config options */
    options?: SpriteSourceConfig,
  ) {
    // Reset issues
    this.issues.length = 0;

    const config = await this.loadConfig(options);

    // Process any staging folders
    for (const staging of config.staging ?? []) {
      // Do them sequentially since later patterns could overlap earlier ones
      await this.resolveStaged(staging);
    }

    // Update the sprite info cache
    const info = await this.updateSpriteInfo(config.ignore);

    return info;
  }

  /**
   * @param options If specified, creates/overwrites the config file with these options.
   */
  static async from(spritesRoot: string | Pathy, options?: SpriteSourceConfig) {
    // Ensure the spritesRoot exists
    assert(
      await pathy(spritesRoot).exists(),
      `Sprites root does not exist: ${spritesRoot}`,
    );
    const source = new SpriteSource(spritesRoot);
    if (options) {
      await source.loadConfig(options);
    }
    return source;
  }
}
