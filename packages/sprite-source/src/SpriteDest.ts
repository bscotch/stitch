import { Pathy, pathy } from '@bscotch/pathy';
import { yypSchema, type Yyp } from '@bscotch/yy';
import { SpriteCache } from './SpriteCache.js';
import { spriteDestConfigSchema } from './SpriteDest.schemas.js';
import type { SpriteSource } from './SpriteSource.js';
import { assert } from './utility.js';

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

  async import(spriteSource: SpriteSource) {
    // Ensure the source and destination are up to date
    const [sourceCache, destCache] = await Promise.all([
      spriteSource.update(),
      this.updateSpriteInfo(),
    ]);

    // TODO: Diff the caches to find out what needs to be done

    // TODO: Ensure the .yyp is up to date
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
