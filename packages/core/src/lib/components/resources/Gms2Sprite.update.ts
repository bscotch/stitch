import { pathy, Pathy } from '@bscotch/pathy';
import { Spritely, SpritelySubimage } from '@bscotch/spritely';
import { memoize, pick } from '@bscotch/utility';
import { SpriteBoundingBoxMode, Yy } from '@bscotch/yy';
import { z } from 'zod';
import {
  assert,
  assertIsNumber,
  StitchError,
} from '../../../utility/errors.js';
import { debug, info } from '../../../utility/log.js';
import paths from '../../../utility/paths.js';
import { uuidV4 } from '../../../utility/uuid.js';
import type { Gms2Sprite } from './Gms2Sprite.js';

/**
 * Ensure that the dimensions of the sprite and its bounding
 * box match the dimensions of the source image. If not, assuming
 * linear scaling and adjust all dims.
 *
 * Returns `true` if an update was necessary and `false` otherwise.
 */
export function setSpriteDims(
  this: Gms2Sprite,
  width: number,
  height: number,
  isNew: boolean,
): boolean {
  for (const dim of ['width', 'height'] as const) {
    const value = { width, height }[dim];
    assertIsNumber(value, `${dim} is not a number: ${value}`);
    assert(value > 0, `${dim} must be > 0: ${value}`);
  }

  // Get the old height/width and origin for reference
  const oldOriginX = this.yyData.sequence.xorigin;
  const oldOriginY = this.yyData.sequence.yorigin;
  const oldHeight = this.yyData.height;
  const oldWidth = this.yyData.width;

  const oldBbox = pick(this.yyData, [
    'bbox_bottom',
    'bbox_right',
    'bbox_top',
    'bbox_left',
  ]);

  this.yyData.height = height;
  this.yyData.width = width;
  this.yyData.bbox_bottom ||= height;
  this.yyData.bbox_right ||= width;

  const _scaleCoord = (oldPos: number, oldMax: number, newMax: number) => {
    if ([oldPos, oldMax, newMax].some((val) => val == 0)) {
      return 0;
    }
    return Math.floor((oldPos / oldMax) * newMax);
  };

  const dimsHaveChanged = !isNew && (width != oldWidth || height != oldHeight);
  if (isNew) {
    this.yyData.sequence.xorigin = Math.floor(width / 2);
    this.yyData.sequence.yorigin = Math.floor(height / 2);
  } else if (dimsHaveChanged) {
    this.yyData.sequence.xorigin = _scaleCoord(oldOriginX, oldWidth, width);
    this.yyData.sequence.yorigin = _scaleCoord(oldOriginY, oldHeight, height);
  }
  if (
    dimsHaveChanged &&
    this.yyData.bboxMode == SpriteBoundingBoxMode.FullImage
  ) {
    // Adjust to dims
    this.yyData.bbox_left = 0;
    this.yyData.bbox_top = 0;
    this.yyData.bbox_right = width;
    this.yyData.bbox_bottom = height;
  } else if (dimsHaveChanged) {
    // Adjust *relatively*
    const bboxScaleInfo = [
      {
        oldMax: oldWidth,
        max: width,
        fields: ['bbox_right', 'bbox_left'] as const,
      },
      {
        oldMax: oldHeight,
        max: height,
        fields: ['bbox_top', 'bbox_bottom'] as const,
      },
    ];
    for (const bbox of bboxScaleInfo) {
      for (const field of bbox.fields) {
        this.yyData[field] = _scaleCoord(oldBbox[field], bbox.oldMax, bbox.max);
      }
    }
  }
  return true;
}

export function deleteExtraneousSpriteImages(this: Gms2Sprite) {
  const framePaths = this.storage.listFilesSync(this.yyDirAbsolute, true, [
    'png',
  ]);
  // Composite frames
  for (const framePath of framePaths) {
    // Since frameIds are GUIDs, we can just check for it as
    // a substring without worrying about exactly where it appears
    // in the path.
    if (this.frameIds.some((frameId) => framePath.includes(frameId))) {
      continue;
    }
    this.storage.deleteFileSync(framePath);
    debug(`deleted old frame ${framePath}`);
  }
  return this;
}

class SpineSpriteUpdater {
  readonly srcJson: Pathy<{ skeleton: { spine: string } }>;
  readonly srcAtlas: Pathy;
  readonly srcDir: Pathy;

  constructor(jsonSourcePath: string, name?: string) {
    this.srcJson = pathy(jsonSourcePath).withValidator(
      z.object({
        skeleton: z.object({
          spine: z.string(),
        }),
      }),
    );
    this.srcAtlas = this.srcJson.changeExtension('atlas');
    this.srcDir = this.srcJson.up();
  }

  @memoize
  async srcFiles(ext?: string | string[]) {
    return (await this.srcDir.listChildren()).filter(
      (p) => !ext || p.hasExtension(ext),
    );
  }

  async assertValid() {
    const validations = await Promise.allSettled([
      this.assertValidJson(),
      this.srcAtlas.exists({ assert: true }),
      // There must be at one image with exactly the same name as the JSON file,
      // though there may also be additional images.
      this.srcJson.changeExtension('png').exists({ assert: true }),
    ]);
    assert(
      validations.every((v) => v.status === 'fulfilled'),
      'Invalid Spine source files.',
    );
  }

  protected async assertValidJson() {
    // Will throw if it cannot be parsed.
    try {
      await this.srcJson.read();
    } catch (err) {
      throw new StitchError(`Not a valid Spine JSON file: ${this.srcJson}`);
    }
  }
}

export async function syncSpineSource(
  this: Gms2Sprite,
  spineSourceJson: string,
) {
  assert(this.isSpine, 'This method can only be used for Spine sprites');
  const spineUpdater = new SpineSpriteUpdater(spineSourceJson, this.name);
  await spineUpdater.assertValid();
  const frameId = this.yyData.frames[0]?.name || uuidV4();
  this.yyData.frames[0] = { ...this.yyData.frames[0], name: frameId };
  this.yyData.frames.splice(1);
  const srcFiles = await spineUpdater.srcFiles(['png', 'json', 'atlas']);
  const destDir = pathy(this.yyDirAbsolute);
  const changedFiles: Pathy[] = [];
  for (const srcFile of srcFiles) {
    const destFile = srcFile.hasExtension('png')
      ? destDir.join(srcFile.basename)
      : destDir.join(`${frameId}${srcFile.extname}`);
    let overwrite = !(await destFile.exists());
    overwrite ||=
      srcFile.hasExtension('png') &&
      !(await new SpritelySubimage(srcFile.absolute).equals(destFile.absolute));
    overwrite ||=
      !srcFile.hasExtension('png') &&
      !Yy.areEqual(await srcFile.read(), await destFile.read());
    if (overwrite) {
      changedFiles.push(destFile);
      await srcFile.copy(destFile);
    }
  }
  if (changedFiles.length) {
    info(`spine sprite ${this.name} changed`, { updated: changedFiles });
  }
  return this.save();
}

export async function syncSpriteSource(
  this: Gms2Sprite,
  spriteDirectory: string,
  isNew: boolean,
) {
  assert(!this.isSpine, 'This method cannot be used for Spine sprites');
  debug(`syncing sprite with source ${spriteDirectory}`);
  const sprite = new Spritely(spriteDirectory);
  // Ensure that the sizes match
  const updatedDims = setSpriteDims.bind(this)(
    sprite.width as number,
    sprite.height as number,
    isNew,
  );

  // Replace all frames, but keep the existing IDs and ID
  // order where possible. (Minimizes useless git history changes.)
  const layersRoot = paths.join(this.yyDirAbsolute, 'layers');
  this.storage.ensureDirSync(layersRoot);
  // Remove excess frame data if needed
  this.yyData.frames.splice(sprite.paths.length);
  // Add each frame, updating the yyData as we go.
  const updatedFrames: Pathy[] = [];
  for (const [i, subimagePath] of sprite.paths.entries()) {
    if (!this.yyData.frames[i]) {
      this.yyData.frames[i] = { name: uuidV4() } as any;
    }
    const frameId = this.yyData.frames[i].name;
    debug(
      `adding frame ${i} using id ${frameId} from image at ${subimagePath}`,
    );
    const updatedFrame = await this.updateFrameImage(subimagePath, frameId);
    if (updatedFrame) {
      updatedFrames.push(pathy(updatedFrame.path));
    }
  }
  if (updatedFrames.length || updatedDims) {
    info(`sprite ${this.name} changed`, {
      frames: updatedFrames.length ? updatedFrames : undefined,
      dims: updatedDims ? true : undefined,
    });
  }
  deleteExtraneousSpriteImages.bind(this)();
  return this.save();
}
