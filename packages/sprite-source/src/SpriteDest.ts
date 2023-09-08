import { Pathy, pathy } from '@bscotch/pathy';
import { Yy } from '@bscotch/yy';
import { SpriteCache } from './SpriteCache.js';
import type {
  SpineSummary,
  SpriteSummary,
  SpritesInfo,
} from './SpriteCache.schemas.js';
import {
  applySpriteAction,
  type SpriteDestActionResult,
} from './SpriteDest.actions.js';
import {
  SpriteDestAction,
  spriteDestConfigSchema,
  type SpriteDestConfig,
  type SpriteDestSource,
} from './SpriteDest.schemas.js';
import { SpriteSource } from './SpriteSource.js';
import { Reporter } from './types.js';
import { assert, rethrow } from './utility.js';

export class SpriteDest extends SpriteCache {
  protected constructor(
    spritesRoot: string | Pathy,
    readonly yypPath: Pathy,
  ) {
    super(spritesRoot, 1);
  }

  get configFile() {
    return this.stitchDir
      .join('sprites.import.json')
      .withValidator(spriteDestConfigSchema);
  }

  protected async inferChangeActions(
    sourceConfig: SpriteDestSource,
    destSpritesCache: SpritesInfo,
  ) {
    const destSpritesInfo = destSpritesCache.info;
    // Get the most up-to-date source and dest info
    const ignorePatterns = (sourceConfig.ignore || []).map(
      (x) => new RegExp(x),
    );
    const source = await SpriteSource.from(sourceConfig.source);
    const sourceSpritesInfo = await source.update().then((x) => x.info);

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
          kind: 'create',
          spine: sourceSprite.spine,
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
          kind: 'update',
          spine: true,
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
          spine: false,
          name: destSprite.name,
          source: sourceDir,
          dest: destDir,
        });
      }
    }

    return actions;
  }

  /**
   * @param overrides Optionally override the configuration file (if it exists)
   */
  async import(overrides?: SpriteDestConfig, reporter?: Reporter) {
    let percentComplete = 0;
    const report = (byPercent: number, message?: string) => {
      percentComplete += byPercent;
      reporter?.report({ message, increment: byPercent });
    };

    report(0, 'Updating project cache...');
    const [configResult, destSpritesInfoResult, yypResult] =
      await Promise.allSettled([
        this.loadConfig(overrides),
        this.updateSpriteInfo(),
        Yy.read(this.yypPath.absolute, 'project'),
      ]);
    assert(
      yypResult.status === 'fulfilled',
      'Project file is invalid',
      yypResult.status === 'rejected' ? yypResult.reason : undefined,
    );
    assert(
      configResult.status === 'fulfilled',
      'Could not load config',
      configResult.status === 'rejected' ? configResult.reason : undefined,
    );
    assert(
      destSpritesInfoResult.status === 'fulfilled',
      'Could not load sprites info',
      destSpritesInfoResult.status === 'rejected'
        ? destSpritesInfoResult.reason
        : undefined,
    );

    const config = configResult.value;
    const destSpritesInfo = destSpritesInfoResult.value;
    const yyp = yypResult.value;

    // Collect info from the yyp about existing folders, sprites,
    // and assets. Goals are:
    // - Faster lookups (e.g. using sets)
    // - Ensure we won't have an asset name clash
    const existingFolders = new Set<string>();
    const existingSprites = new Set<string>();
    const existingAssets = new Set<string>();
    yyp.resources.forEach((r) => {
      if (r.id.path.startsWith('sprites')) {
        existingSprites.add(r.id.name);
      }
      existingAssets.add(r.id.name);
    });
    yyp.Folders.forEach((f) => {
      existingFolders.add(f.folderPath);
    });

    // Try to do it all at the same time for perf. Race conditions
    // and order-of-ops issues indicate some kind of user
    // config failure, so we'll let that be their problem.
    report(10, 'Computing changes...');
    const actions: SpriteDestAction[] = [];
    const getActionsWaits: Promise<any>[] = [];
    for (const sourceConfig of config.sources || []) {
      // Report errors but do not throw. We want to continue
      // to subsequent sources even if one fails.
      getActionsWaits.push(
        this.inferChangeActions(sourceConfig, destSpritesInfo).then(
          (a) => {
            actions.push(...a);
          },
          (err) => {
            this.issues.push({
              level: 'error',
              message: `Error importing from "${sourceConfig.source}"`,
              cause: err,
            });
          },
        ),
      );
    }
    await Promise.allSettled(getActionsWaits);

    // Apply the actions (in parellel)
    report(10, `Applying changes to ${actions.length} sprites...`);
    const appliedActions: SpriteDestActionResult[] = [];
    const applyActionsWaits: Promise<any>[] = [];

    let percentForYypUpdate = 5;
    let percentPerAction =
      (100 - percentComplete - percentForYypUpdate) / actions.length;
    for (const action of actions) {
      if (existingAssets.has(action.name)) {
        this.issues.push({
          level: 'warning',
          message: `Asset name collision: ${action.name}`,
        });
        continue;
      }
      applyActionsWaits.push(
        applySpriteAction({
          projectYypPath: this.yypPath.absolute,
          action,
        })
          .then((result) => {
            appliedActions.push(result);
          })
          .catch((err) => {
            this.issues.push({
              level: 'error',
              message: `Error applying action: ${JSON.stringify(action)}`,
              cause: err,
            });
          })
          .finally(() => {
            report(percentPerAction);
          }),
      );
    }
    await Promise.allSettled(applyActionsWaits);
    if (!appliedActions.length) {
      return;
    }

    // Ensure the .yyp is up to date
    report(0, 'Updating project file...');
    for (const appliedAction of appliedActions) {
      if (!existingSprites.has(appliedAction.resource.name)) {
        yyp.resources.push({
          id: appliedAction.resource,
        });
        existingSprites.add(appliedAction.resource.name);
      }
      if (!existingFolders.has(appliedAction.folder.folderPath)) {
        // @ts-expect-error The object is partial, but gets validated and completed on write
        yyp.Folders.push(appliedAction.folder);
        existingFolders.add(appliedAction.folder.folderPath);
      }
    }
    await Yy.write(this.yypPath.absolute, yyp, 'project');
    return appliedActions;
  }

  protected async loadConfig(
    overrides: SpriteDestConfig = {},
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
    const projectYyp = pathy(projectYypPath);
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
