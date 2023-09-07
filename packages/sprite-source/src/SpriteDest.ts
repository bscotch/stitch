import { Pathy, pathy } from '@bscotch/pathy';
import { yypSchema, type Yyp } from '@bscotch/yy';
import { SpriteCache } from './SpriteCache.js';
import type { SpineSummary, SpriteSummary } from './SpriteCache.schemas.js';
import {
  SpriteDestAction,
  spriteDestConfigSchema,
  type SpriteDestConfig,
  type SpriteDestSource,
} from './SpriteDest.schemas.js';
import { SpriteSource } from './SpriteSource.js';
import { assert, rethrow } from './utility.js';

export class SpriteDest extends SpriteCache {
  protected constructor(
    spritesRoot: string | Pathy,
    readonly yyp: Pathy<Yyp>,
  ) {
    super(spritesRoot, 1);
  }

  get configFile() {
    return this.stitchDir
      .join('sprites.import.json')
      .withValidator(spriteDestConfigSchema);
  }

  protected async importSource(sourceConfig: SpriteDestSource) {
    // Get the most up-to-date source and dest info
    const ignorePatterns = (sourceConfig.ignore || []).map(
      (x) => new RegExp(x),
    );
    const source = await SpriteSource.from(sourceConfig.source);
    const [sourceSpritesInfo, destSpritesInfo] = await Promise.all([
      source.update().then((x) => x.info),
      this.updateSpriteInfo().then((x) => x.info),
    ]);

    // Normalize things for direct comparision between source and dest
    type SpriteInfo = (SpriteSummary | SpineSummary) & {
      path: string;
      name: string;
    };

    /** Map of destName.toLower() to the source info */
    const sourceSprites = new Map<string, SpriteInfo>();
    for (const [sourcePath, sourceSprite] of Object.entries(
      sourceSpritesInfo,
    )) {
      // Skip it if it matches the ignore patterns
      if (ignorePatterns.some((x) => x.test(sourcePath))) {
        continue;
      }

      // Get the name it should have in the project
      const name = `${sourceConfig.prefix || ''}${sourcePath
        .split('/')
        .pop()!
        .replace(/[^a-z0-9_]/gi, '_')}`;

      // Check for name collisions. If found, they should be reported as issues.
      if (sourceSprites.get(name.toLowerCase())) {
        this.issues.push({
          level: 'warning',
          message: `Source sprite name collision: ${name}`,
        });
      }

      sourceSprites.set(name.toLowerCase(), {
        ...sourceSprite,
        path: sourcePath,
        name,
      });
    }

    /** Map of destName.toLower() to the dest info */
    const destSprites = new Map<string, SpriteInfo>();
    for (const [destPath, destSprite] of Object.entries(destSpritesInfo)) {
      destSprites.set(destPath.toLowerCase(), {
        ...destSprite,
        path: destPath,
        name: destPath,
      });
    }

    // For each source sprite, diff with the dest sprite to determine what actions need to be performed. Create a list of actions to perform for later execution.

    const actions: SpriteDestAction[] = [];

    for (const [normalizedName, sourceSprite] of sourceSprites) {
      const destSprite = destSprites.get(normalizedName);
      const sourceDir = source.spritesRoot.join(sourceSprite.path).absolute;
      const destDir = this.spritesRoot.join(
        destSprite?.path || sourceSprite.name,
      ).absolute;

      if (!destSprite || sourceSprite.spine !== destSprite.spine) {
        actions.push({
          kind: sourceSprite.spine ? 'create-spine' : 'create',
          name: sourceSprite.name,
          source: sourceDir,
          dest: destDir,
        });
      } else if (
        sourceSprite.spine &&
        destSprite.spine &&
        sourceSprite.checksum !== destSprite.checksum
      ) {
        actions.push({
          kind: 'update-spine',
          name: destSprite.name,
          source: sourceDir,
          dest: destDir,
        });
      } else if (
        !sourceSprite.spine &&
        !destSprite.spine &&
        sourceSprite.checksum !== destSprite.checksum
      ) {
        actions.push({
          kind: 'update',
          name: destSprite.name,
          source: sourceDir,
          dest: destDir,
        });
      }
    }

    console.dir(actions, { depth: null });
  }

  /**
   * @param overrides Optionally override the configuration file (if it exists)
   */
  async import(overrides?: SpriteDestConfig) {
    const config = await this.loadConfig(overrides);

    // Do them sequentially so we don't have to worry about
    // any race conditions or overlapping outcomes.
    for (const sourceConfig of config.sources) {
      // Report errors but do not throw. We want to continue
      // to subsequent sources even if one fails.
      await this.importSource(sourceConfig).catch((err) => {
        this.issues.push({
          level: 'error',
          message: `Error importing from "${sourceConfig.source}"`,
          cause: err,
        });
      });
    }

    // TODO: Ensure the .yyp is up to date
  }

  protected async loadConfig(
    overrides?: SpriteDestConfig,
  ): Promise<SpriteDestConfig> {
    // Validate options. Show error out if invalid.
    try {
      overrides = spriteDestConfigSchema.parse(overrides);
    } catch (err) {
      rethrow(err, 'Invalid SpriteDest options');
    }
    assert(
      await this.spritesRoot.isDirectory(),
      'Source must be an existing directory.',
    );
    // Update the config
    await this.stitchDir.ensureDirectory();
    const config = await this.configFile.read({ fallback: { sources: [] } });
    if (overrides?.sources) {
      config.sources = overrides.sources;
    }
    await this.configFile.write(config);
    return config;
  }

  static async from(projectYypPath: string | Pathy) {
    // Ensure the project file exists
    assert(
      projectYypPath.toString().endsWith('.yyp'),
      'The project path must be to a .yyp file',
    );
    const projectYyp = pathy(projectYypPath).withValidator(yypSchema);
    assert(
      await projectYyp.exists(),
      `Project file does not exist: ${projectYyp}`,
    );

    // Ensure the project has a sprites folder
    const projectFolder = projectYyp.up();
    const spritesRoot = projectFolder.join('sprites');
    await spritesRoot.ensureDirectory();

    // Create the cache in the sprites folder
    const cache = new SpriteDest(spritesRoot, projectYyp);
    return cache;
  }
}
