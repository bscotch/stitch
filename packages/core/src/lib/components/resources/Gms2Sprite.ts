import { Pathy } from '@bscotch/pathy';
import { SpritelySubimage } from '@bscotch/spritely';
import { SpriteType, YySprite } from '@bscotch/yy';
import { Spine } from '../../../types/Spine.js';
import { assert } from '../../../utility/errors.js';
import { debug } from '../../../utility/log.js';
import paths from '../../../utility/paths.js';
import type { StitchProjectComms } from '../../StitchProject.js';
import {
  Gms2ResourceBase,
  Gms2ResourceBaseParameters,
} from './Gms2ResourceBase.js';
import { syncSpineSource, syncSpriteSource } from './Gms2Sprite.update.js';

export class Gms2Sprite extends Gms2ResourceBase<YySprite> {
  constructor(...setup: Gms2ResourceBaseParameters) {
    super('sprites', ...setup);
  }

  get isSpine() {
    return this.spriteType === SpriteType.Spine;
  }

  get textureGroup() {
    return this.yyData.textureGroupId.name;
  }
  set textureGroup(name: string) {
    this.yyData.textureGroupId.name = name;
    this.yyData.textureGroupId.path = `texturegroups/${name}`;
    this.save();
  }

  /** Get the array of current frameIds, in their frame order. */
  get frameIds() {
    return this.yyData.frames.map((frame) => frame.name);
  }

  get spriteType() {
    return this.yyData.type;
  }
  set spriteType(type: SpriteType) {
    this.yyData.type = type;
  }

  /** Force a layerId. Only updates the YY file, and only if there is only 1 layer. */
  setLayerId(layerId: string) {
    assert(
      this.yyData.layers.length === 1,
      'Cannot force the layerId if only one layer present.',
    );
    this.yyData.layers[0].name = layerId;
    return this;
  }

  /**
   * Update a sprite frame from a source image. If the frame
   * already has an identical image, this will return `undefined`.
   */
  async updateFrameImage(
    imagePath: string,
    frameGuid: string,
  ): Promise<SpritelySubimage | undefined> {
    assert(
      !this.isSpine,
      'Cannot update frame images for Spine sprites this way.',
    );
    const framePath = paths.join(this.yyDirAbsolute, `${frameGuid}.png`);
    const frameLayerFolder = paths.join(
      this.yyDirAbsolute,
      'layers',
      frameGuid,
    );
    const layerId = this.yyData.layers[0].name;
    const frameLayerImagePath = paths.join(frameLayerFolder, `${layerId}.png`);
    this.storage.ensureDirSync(frameLayerFolder);
    // Only clobber if the image is meaningfully different
    const sourceImage = new SpritelySubimage(imagePath);
    const frame = new SpritelySubimage(framePath);
    if (!(await frame.exists()) || !(await frame.equals(sourceImage))) {
      debug(`Content mismatching, replaced ${framePath} with source.`);
      this.storage.copyFileSync(imagePath, framePath);
      this.storage.copyFileSync(imagePath, frameLayerImagePath);
      return frame;
    } else {
      debug(`Content matched source, leaving ${framePath} untouched.`);
      return;
    }
  }

  /**
   * Force the frames of this sprite to match the images
   * within a folder (non-recursive)
   */
  async syncWithSource(spriteDirectoryOrSpineJson: string, isNew: boolean) {
    if (this.isSpine) {
      return await syncSpineSource.bind(this)(spriteDirectoryOrSpineJson);
    } else {
      return await syncSpriteSource.bind(this)(
        spriteDirectoryOrSpineJson,
        isNew,
      );
    }
  }

  /**
   * Create a new sprite
   * @param subimageDirectory Absolute path to a directory containing the
   *                          subimages for this sprite. Will non-recursively
   *                          search for png images within that directory
   *                          and sort them alphabetically.
   */
  static async create(
    subimageDirectory: string,
    comms: StitchProjectComms,
    spriteName?: string,
  ) {
    const sprite = new Gms2Sprite(
      spriteName || paths.subfolderName(subimageDirectory),
      comms,
    );
    await sprite.replaceYyFile({
      name: sprite.name,
    });
    return await sprite.syncWithSource(subimageDirectory, true);
  }

  static async createFromSpine(
    spineJsonFile: Pathy<Spine>,
    comms: StitchProjectComms,
    spriteName?: string,
  ) {
    const sprite = new Gms2Sprite(
      spriteName || paths.subfolderName(spineJsonFile.directory),
      comms,
    );
    await sprite.replaceYyFile({
      type: SpriteType.Spine,
      name: sprite.name,
    });
    return await sprite.syncWithSource(spineJsonFile.absolute, true);
  }
}
