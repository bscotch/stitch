import {
  YySprite,
  SpriteBoundingBoxMode,
  SpriteLayerBlendMode,
  SpriteCollisionKind,
  SpriteOrigin,
  SpritePlaybackSpeedType,
  yyDataConstants,
  yyDataLayerConstants,
  yyDataSequenceConstants,
  yyDataSequenceTrackConstants,
} from "../../../types/YySprite";
import { assert, Gms2PipelineError } from "../../errors";
import { Gms2Storage } from "../../Gms2Storage";
import paths from "../../paths";
import { oneline } from "../../strings";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";
import sharp from "sharp";
import {uuidV4,uuidV5,UuidNamespace} from "../../uuid";

interface SpriteFrameSource {
  sourcePath:string,
  name:string,
  guid:string,
}

interface SpriteSource {
  guid: string,
  spriteName: string,
  width: number,
  height: number,
  frames: SpriteFrameSource[]
}

export class Gms2Sprite extends Gms2ResourceBase {

  protected yyData!: YySprite; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super("sprites",...setup);
  }

  get textureGroup(){
    return this.yyData.textureGroupId.name;
  }

  set textureGroup(name:string){
    this.yyData.textureGroupId.name = name;
    this.yyData.textureGroupId.path = `texturegroups/${name}`;
    this.save();
  }

  protected createYyFile(){
    // Create a frameless sprite template
    const firstLayerId = uuidV4();

    const yyData: YySprite = {
      ...yyDataConstants,
      bboxMode: SpriteBoundingBoxMode.Automatic,
      bbox_bottom: 0,
      bbox_left: 0, // Should set later based on frame dims
      bbox_right: 0,
      bbox_top: 0, // Should set based on frame dims
      collisionKind: SpriteCollisionKind.Rectangle,
      origin: SpriteOrigin.Custom,
      collisionTolerance: 0,
      edgeFiltering: false,
      frames: [], // Add frames later based on subimages!
      height: 0, // Set later based on subimages!
      layers: [
        {
          ...yyDataLayerConstants,
          blendMode: SpriteLayerBlendMode.Normal,
          displayName: "default",
          name: firstLayerId,
          opacity: 100,
          isLocked: false,
          visible: true,
        }
      ],
      name: this.name,
      parent: Gms2Sprite.parentDefault,
      preMultiplyAlpha: false,
      sequence: {
        ...yyDataSequenceConstants,
        length: 0, // Update with number of frames
        name: this.name,
        parent:  this.id,
        playbackSpeed: 60,
        playbackSpeedType: SpritePlaybackSpeedType.FramesPerSecond,
        spriteId: this.id,
        tracks: [
          {
            ...yyDataSequenceTrackConstants,
            keyframes: {
              Keyframes: [], // Update once there are frames to add
              resourceType: "KeyframeStore<SpriteFrameKeyframe>",
              resourceVersion: "1.0"
            },
          }
        ],
        xorigin: 0, // Update with the origin of the sprite
        yorigin: 0, // Update with the origin of the sprite
      },
      tags: [],
      textureGroupId: Gms2Sprite.textureGroupIdDefault,
      width: 0
    };
    this.storage.saveJson(this.yyPathAbsolute,yyData);
  }

  /** Force the frames of this sprite to match the images within a folder (non-recursive)  */
  async replaceFrames(subimageDirectory:string){
    const imageData = await Gms2Sprite.getSpriteDataFromSourceDirectory(subimageDirectory,this.storage);
    // TODO
    // If the current Sprite has no frames,

    return this;
  }

  /**
   * Given an external folder of images, where the folder corresponds to a sprite
   * and the images to its frames, compute the data needed to be able to make use
   * of those frames to update/create a GMS2 Sprite resource.
   */
  static async getSpriteDataFromSourceDirectory(spriteDirectory:string,storage:Gms2Storage){
    // Find the subimages
    const subimagePaths = storage.listFiles(spriteDirectory,false,['png']);
    assert(subimagePaths.length,`No png subimages found in ${spriteDirectory}`);
    // Make sure all images are the same size and are actual PNGs
    const spriteName = paths.subfolderName(spriteDirectory);
    const spriteInfo: SpriteSource = {
      guid: uuidV5(spriteName,UuidNamespace.Sprite),
      spriteName,
      width:0,
      height:0,
      frames: []
    };
    for(const subimagePath of subimagePaths){
      const subimageInfo = await sharp(subimagePath).metadata();
      assert(subimageInfo.format=='png',`Subimage ${subimagePath} is not in PNG format.`);
      if(!subimageInfo.width || !subimageInfo.height){
        throw new Gms2PipelineError(`Subimage ${subimagePath} is malformed: missing a width or height.`);
      }
      if(!spriteInfo.frames.length){
        spriteInfo.width = subimageInfo.width;
        spriteInfo.height = subimageInfo.height;
      }
      else{
        assert(
          subimageInfo.width == spriteInfo.width && subimageInfo.height == spriteInfo.height,
          oneline`Subimage ${subimagePath} has different dimensions (${subimageInfo.width}x${subimageInfo.height})
                  than prior subimages (${spriteInfo.width}x${spriteInfo.height})`
        );
      }
      const frameName = paths.basename(subimagePath);
      const frame = {
        sourcePath: subimagePath,
        name: frameName,
        guid: uuidV5(frameName,spriteInfo.guid)
      };
      spriteInfo.frames.push(frame);
    }
    return spriteInfo;
  }

  static get textureGroupIdDefault(){
    return {
      name: 'Default',
      path: "texturegroups/Default",
    };
  }

  /**
   * Create a new sprite
   * @param subimageDirectory Absolute path to a directory containing the
   *                          subimages for this sprite. Will non-recursively
   *                          search for png images within that directory
   *                          and sort them alphabetically.
   */
  static async create(subimageDirectory:string,storage:Gms2Storage,spriteName?:string): Promise<Gms2Sprite> {
    return new Gms2Sprite(spriteName||paths.subfolderName(subimageDirectory),storage,true)
      .replaceFrames(subimageDirectory);
  }

}
