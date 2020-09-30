import {
  YySprite,
  SpriteBoundingBoxMode,
  SpriteCollisionKind,
  SpriteOrigin,
  SpritePlaybackSpeedType,
} from "../../../types/YySprite";
import { assert, Gms2PipelineError } from "../../errors";
import { Gms2Storage } from "../../Gms2Storage";
import paths from "../../paths";
import { oneline } from "../../strings";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";
import sharp from "sharp";

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
    const yyData: YySprite = {
      name: this.name,
      bboxMode: SpriteBoundingBoxMode.Automatic,
      collisionKind: SpriteCollisionKind.Rectangle,
      type: 0,
      origin: SpriteOrigin.MiddleCenter,
      preMultiplyAlpha: true,
      edgeFiltering: true,
      collisionTolerance: 0,
      swfPrecision: 2.525,
      bbox_left: 0,
      bbox_right: 0,
      bbox_top: 0,
      bbox_bottom: 0,
      HTile: false,
      VTile: false,
      For3D: false,
      width: 0,
      height: 0,
      tags: [],
      swatchColours: null,
      gridX: 0,
      gridY: 0,
      parent: Gms2Sprite.parentDefault,
      textureGroupId: Gms2Sprite.textureGroupIdDefault,
      resourceType: "GMSprite",
      resourceVersion: "1.0",
    };
    this.storage.saveJson(this.yyPathAbsolute,yyData);
  }

  /**
   * Create a new sprite
   * @param subimageDirectory Absolute path to a directory containing the
   *                          subimages for this sprite. Will non-recursively
   *                          search for png images within that directory
   *                          and sort them alphabetically.
   */
  static async create(subimageDirectory:string,storage:Gms2Storage): Gms2Sprite {
    const imageData = Gms2Sprite.getSubimageData(subimageDirectory,storage);
    // TODO: Figure all this out!
  }

  static async getSubimageData(subimageDirectory:string,storage:Gms2Storage){
    // Find the subimages
    const subimagePaths = storage.listFiles(subimageDirectory,false,['png']);
    assert(subimagePaths.length,`No png subimages found in ${subimageDirectory}`);
    // Make sure all images are the same size and are actual PNGs
    const subimagesSummary = {width:0,height:0,sourcePaths:[] as string[],names:[] as string[]};
    for(const subimagePath of subimagePaths){
      const subimageInfo = await sharp(subimagePath).metadata();
      assert(subimageInfo.format=='png',`Subimage ${subimagePath} is not in PNG format.`);
      if(!subimageInfo.width || !subimageInfo.height){
        throw new Gms2PipelineError(`Subimage ${subimagePath} is malformed: missing a width or height.`);
      }
      if(!subimagesSummary.names.length){
        subimagesSummary.width = subimageInfo.width;
        subimagesSummary.height = subimageInfo.height;
      }
      else{
        assert(
          subimageInfo.width == subimagesSummary.width && subimageInfo.height == subimagesSummary.height,
          oneline`Subimage ${subimagePath} has different dimensions (${subimageInfo.width}x${subimageInfo.height})
                  than prior subimages (${subimagesSummary.width}x${subimagesSummary.height})`
        );
      }
      subimagesSummary.sourcePaths.push(subimagePath);
      subimagesSummary.names.push(paths.basename(subimagePath));
    }
    return subimagesSummary;
  }

  static get textureGroupIdDefault(){
    return {
      name: 'Default',
      path: "texturegroups/Default",
    };
  }
}
