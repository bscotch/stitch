import { listFoldersSync } from '@bscotch/utility';
import { Spritely } from './Spritely.js';

export class SpritelyBatch {
  private spriteInstances: Spritely[] = [];
  private spritesRoot: string;

  /**
   * Create a SpritelyBatch instance based on
   * a root directory containing any number of
   * (optionally nested) sprites, where a "sprite"
   * is a folder with immediate PNG children that
   * are all of the exact same dimensions.
   * @param spritesDir Sprite folder or root folder containing sprites.
   * Defaults to current working directory.
   */
  constructor(spritesDir?: string, recursive = true) {
    this.spritesRoot = spritesDir || process.cwd();
    this.spriteInstances = (
      recursive
        ? [spritesDir, ...listFoldersSync(this.spritesRoot, recursive)]
        : [spritesDir]
    )
      .map((spriteDir) => {
        try {
          return new Spritely(spriteDir);
        } catch {
          return null;
        }
      })
      .filter((x) => x) as Spritely[];
  }

  /**
   * Get a shallow copy of the Spritely instances stored
   * by this batch instance.
   */
  get sprites() {
    return [...this.spriteInstances];
  }

  /** Root folder used to discover sprites */
  get path() {
    return this.spritesRoot;
  }
}
