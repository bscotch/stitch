import { default as nonRetryFs } from 'fs-extra';
import path from 'path';

// The 'image-size' module allows for synchronous operation,
// which is not provided by 'sharp' (the primary image manipulation pipeline),
// but is needed since Typescript constructors are synchronous.
import { pathy } from '@bscotch/pathy';
import { memoize, MemoizedClass } from '@bscotch/utility';
import yaml from 'yaml';
import { assert, assertDirectoryExists } from './errors.js';
import { GradientMap } from './GradientMap.js';
import { debug } from './log.js';
import { SpritelyStatic } from './Spritely.static.js';
import { GradientMapsFile, SpritelyOptions } from './Spritely.types.js';
import { SpritelySubimage } from './SpritelySubimage.js';
import { fsRetry as fs } from './utility.js';

export interface Spritely extends MemoizedClass {}

@memoize
export class Spritely extends SpritelyStatic {
  private spriteRoot: string = process.cwd();
  private subimagePaths: string[] = [];
  private subimageWidth: number | undefined;
  private subimageHeight: number | undefined;
  private options: SpritelyOptions;
  gradientMapsFile?: string;

  /**
   * Create a Sprite instance using a folder full of sprite subimages.
   * @param options Either the path to the sprite folder, or a SpritelyOptions object
   */
  constructor(options?: string | SpritelyOptions) {
    super();
    this.options =
      typeof options == 'string' ? { spriteDirectory: options } : options || {};
    this.load();
  }

  get allowSubimageSizeMismatch() {
    return Boolean(this.options.allowSubimageSizeMismatch);
  }

  async isSpine() {
    const hasAtlas = (await pathy(this.spriteRoot).listChildren()).find((p) =>
      p.hasExtension('atlas'),
    );
    return !!hasAtlas;
  }

  private load() {
    this.clearMemoized();
    this.spriteRoot = this.options.spriteDirectory || this.spriteRoot;
    assertDirectoryExists(this.spriteRoot);
    this.subimagePaths = Spritely.getSubimages(this.spriteRoot);
    const { width, height } = Spritely.getSubimagesSizeSync(
      this.subimagePaths,
      this.allowSubimageSizeMismatch,
    );
    this.subimageWidth = width;
    this.subimageHeight = height;
    this.gradientMapsFile = this.options.gradientMapsFile;
    return this;
  }

  /** The name of this sprite (its folder name) */
  get name() {
    return path.basename(this.spriteRoot);
  }
  get width() {
    return this.subimageWidth;
  }
  get height() {
    return this.subimageHeight;
  }

  /** Subimage (frame) paths */
  get paths() {
    assert(this.subimagePaths.length, `Sprite ${this.name} has no subimages`);
    return [...this.subimagePaths];
  }

  /** Sprite (folder) path */
  get path() {
    return this.spriteRoot;
  }

  /**
   * Get the checksum of each subimage, calculated on the pixel values
   * only (metadata excluded). Useful for checking equality or tracking content changes.
   */
  get checksums(): Promise<string[]> {
    return Promise.all(
      this.paths.map((imagePath) => Spritely.pixelsChecksum(imagePath)),
    );
  }

  /**
   * Get the Sprite's subimages as
   * {@link SpritelySubimage} instances.
   */
  @memoize
  get subimages(): ReadonlyArray<SpritelySubimage> {
    return this.paths.map((path) => new SpritelySubimage(path));
  }

  /** Check if two sprites are exactly equal (have the same subimages) */
  async equals(otherSprite: Spritely) {
    if (this.paths.length != otherSprite.paths.length) {
      return false;
    }
    for (let i = 0; i < this.paths.length; i++) {
      if (
        !(await Spritely.imagesAreEqual(this.paths[i], otherSprite.paths[i]))
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Remove excess padding around subimages. Takes into account all subimages
   * so that all are cropped in exactly the same way.
   * **WARNING:** this will overwrite your images!
   * @param extraPadding  Number of padding pixels to keep.
   *                      This should be at least 1 if border correction is also needed.
   */
  async crop(extraPadding = 1) {
    debug('Applying crop to', this.name);
    const boundingBox = {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    };
    await Promise.all(
      this.subimages.map(async (subimage) => {
        // Create a foreground mask and find its bounds
        const subimageBoundingBox = await subimage.boundingBox(extraPadding);
        if (this.allowSubimageSizeMismatch) {
          return await subimage.crop(subimageBoundingBox);
        }
        for (const [dir, side] of [
          ['min', 'left'],
          ['max', 'right'],
          ['min', 'top'],
          ['max', 'bottom'],
        ] as const) {
          boundingBox[side] = Math[dir](
            boundingBox[side],
            subimageBoundingBox[side],
          );
        }
      }),
    );
    if (!this.allowSubimageSizeMismatch) {
      // Then crop all images based on the collective bounding box.
      await Promise.all(
        this.subimages.map((subimage) => subimage.crop(boundingBox)),
      );
    }
    this.clearMemoized();
    return this;
  }

  /** Correct aliasing issues */
  async bleed() {
    debug('Applying bleed to', this.name);
    await Promise.all(this.paths.map((path) => Spritely.bleed(path)));
    return this;
  }

  /**
   * For each gradient map found in `{sprite}/gradmaps.yml`,
   * create a new folder `{sprite}/{gradmapName}/` and fill it
   * with copies of each subimage converted from Grayscale to
   * color using the associated gradMap.
   */
  async applyGradientMaps(deleteSourceImages?: boolean) {
    debug('Attempting to apply gradient maps to', this.name);
    const gradientMaps: [string, ...GradientMap[]] = [
      'none',
      ...this.getGradientMaps(),
    ];
    const waits = gradientMaps.map(async (gradMap) => {
      const destFolder = path.join(
        this.spriteRoot,
        typeof gradMap == 'string' ? gradMap : gradMap.name,
      );
      await fs.ensureDir(destFolder);
      await fs.emptyDir(destFolder);
      for (const subimagePath of this.paths) {
        // Only change if matches pattern
        if (
          typeof gradMap != 'string' &&
          !gradMap.canApplyToImage(this.name, path.parse(subimagePath).name)
        ) {
          continue;
        }
        const destPath = path.join(destFolder, path.basename(subimagePath));
        await fs.copyFile(subimagePath, destPath);
        if (typeof gradMap != 'string') {
          await SpritelyStatic.applyGradientMap(destPath, gradMap);
        }
      }
    });
    await Promise.all(waits);
    if (deleteSourceImages) {
      const removeWaits = this.paths.map((p) => fs.remove(p));
      await Promise.all(removeWaits);
    }
    return this;
  }

  /**
   * Copy this sprite (folder + subimages) to another location.
   * The sprite can be renamed during the copy operation.
   */
  async copy(destinationFolder: string, options?: { name?: string }) {
    debug('Copying', this.name, 'to', destinationFolder);
    const toSpriteFolder = path.join(
      destinationFolder,
      options?.name || this.name,
    );
    await fs.ensureDir(toSpriteFolder);
    const newPaths: string[] = [];
    for (const subimagePath of this.paths) {
      const newPath = path.join(toSpriteFolder, path.basename(subimagePath));
      newPaths.push(newPath);
      await fs.copyFile(subimagePath, newPath);
    }
    return this;
  }

  /**
   * Delete subimages for this sprite. Will cause errors to be thrown
   * for many (but not all) future attempts to do anything with this
   * Spritely instance.
   */
  async delete() {
    for (const subimagePath of this.paths) {
      debug('Deleting', subimagePath);
      await fs.remove(subimagePath);
    }
    // Attempt to remove the folders (and clean recursively)
    await fs.removeEmptyDirs(this.spriteRoot);
    this.subimagePaths = [];
    return this;
  }

  /**
   * Shorthand for .copy() followed by .delete().
   * This instance will update itself to refer to the new location.
   */
  async move(destinationFolder: string) {
    debug('Moving', this.name, 'to', destinationFolder);
    await this.copy(destinationFolder);
    await this.delete();
    this.options.spriteDirectory = path.join(destinationFolder, this.name);
    return this.load();
  }

  getGradientMaps() {
    const defaultNames = ['gradmaps', 'gradients', 'gradmap', 'skins', 'skin']
      .map((name) => ['yml', 'yaml', 'txt'].map((ext) => `${name}.${ext}`))
      .flat(2)
      .map((filename) => path.join(this.spriteRoot, filename));
    const fileNames = this.gradientMapsFile
      ? [this.gradientMapsFile]
      : defaultNames;
    const gradientMaps = [];
    for (const filename of fileNames) {
      if (nonRetryFs.existsSync(filename)) {
        gradientMaps.push(...this.getGradientMapsFromFile(filename));
      }
    }
    return gradientMaps;
  }

  /**
   * Get a list of GradientMaps from a file, with expected format (per line):
   * `gradient-name: position1, colorHex1; position2, colorHex2`
   * Where there can be extra space padding, 'gradient-name' should be forced
   * to kebab case, 'positions' are numbers from 0-100 representing position
   * along the grayscale pallette, and 'colorHex' are RGB colors in hex format.
   */
  private getGradientMapsFromFile(filepath: string) {
    assert(
      nonRetryFs.existsSync(filepath),
      `GradientMap file '${filepath}' does not exist.`,
    );
    const skinInfo = yaml.parse(
      nonRetryFs.readFileSync(filepath, 'utf8'),
    ) as GradientMapsFile;
    const skins = Object.keys(skinInfo.skins);
    return skins
      .map((skin) => {
        const colorMap = skinInfo.skins[skin];
        const patterns =
          !skinInfo.groups || !skinInfo.groups.length
            ? true
            : skinInfo.groups
                .filter((group) => group.skins.includes(skin))
                .map((group) => {
                  return {
                    pattern: new RegExp(group.pattern, 'i'),
                    match: group.match || 'subimage',
                  };
                });
        if (Array.isArray(patterns) && !patterns.length) {
          return false;
        }
        return new GradientMap(
          skin,
          colorMap,
          patterns === true ? [] : patterns,
        );
      })
      .filter((x) => x) as GradientMap[];
  }

  /**
   * Async version of directly using the constructor,
   * useful for parallelizing and preventing thread blocking.
   */
  static async from(
    spritesDir: string = process.cwd(),
    options?: { excludeSpine?: boolean; noRecursion?: boolean },
  ): Promise<Spritely[]> {
    const startingFrom = pathy(spritesDir);
    const sprites = (
      options?.noRecursion
        ? [startingFrom]
        : [
            startingFrom,
            ...(await startingFrom.listChildrenRecursively({
              includeDirs: 'only',
            })),
          ]
    )
      .map((spriteDir) => {
        try {
          return new Spritely(spriteDir.absolute);
        } catch {
          return null;
        }
      })
      .filter((x) => x) as Spritely[];

    if (options?.excludeSpine) {
      const isSpine = await Promise.all(sprites.map((s) => s.isSpine()));
      return sprites.filter((_, i) => !isSpine[i]);
    }
    return sprites;
  }
}
