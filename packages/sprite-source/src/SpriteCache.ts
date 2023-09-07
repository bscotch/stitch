import { Pathy, pathy } from '@bscotch/pathy';
import { SpritesInfo, spritesInfoSchema } from './SpriteCache.schemas.js';
import { SpriteDir } from './SpriteDir.js';
import type { Issue, Log } from './types.js';
import { getDirs } from './utility.js';

export class SpriteCache {
  readonly issues: Issue[] = [];
  readonly logs: Log[] = [];
  readonly spritesRoot: Pathy;

  /**
   * @param spritesRoot The path to the root directory containing
   * sprites. For a SpriteSource, this is the root of a set
   * of nested folders-of-images. For a SpriteDest (a project),
   * this is the `{project}/sprites` folder.
   * @param maxDepth The maximum depth to search for sprites. For a SpriteSource this is probably Infinity. For a SpriteDest, this should be 1.
   */
  constructor(
    spritesRoot: string | Pathy,
    readonly maxDepth = Infinity,
  ) {
    this.spritesRoot = pathy(spritesRoot);
  }

  get stitchDir() {
    return this.spritesRoot.join('.stitch');
  }

  get cacheFile() {
    return this.stitchDir
      .join('sprites.info.json')
      .withValidator(spritesInfoSchema);
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

  protected async loadCache(): Promise<SpritesInfo> {
    let cache: SpritesInfo;
    try {
      cache = await this.cacheFile.read({
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
  protected async updateSpriteInfo(ignore?: string[] | null) {
    const ignorePatterns = ignore?.map((pattern) => new RegExp(pattern));
    // Load the current cache and sprite dirs
    const [cache, allSpriteDirs] = await Promise.all([
      this.loadCache(),
      getDirs(this.spritesRoot.absolute, this.maxDepth).then((dirs) =>
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
    await this.cacheFile.write(cache);
    return cache;
  }
}
