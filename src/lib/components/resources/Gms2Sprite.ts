import {
  YySprite,
  yyDataDefaults,
  yyDataLayerDefaults,
  yyDataSequenceDefaults,
  yyDataSequenceTrackDefaults,
  SpriteType,
} from "../../../types/YySprite";
import { Gms2Storage } from "../../Gms2Storage";
import paths from "../../paths";
import { Gms2ResourceBase, Gms2ResourceBaseParameters } from "./Gms2ResourceBase";
import {Spritely} from "@bscotch/spritely";
import {uuidV4} from "../../uuid";
import { NumberFixed } from "../../NumberFixed";
import { assert } from "../../errors";

const toSingleDecimalNumber = (number:number|undefined)=>{
  return new NumberFixed(number||0,1);
};
export class Gms2Sprite extends Gms2ResourceBase {

  protected yyData!: YySprite; // Happens in the super() constructor

  constructor(...setup: Gms2ResourceBaseParameters) {
    super("sprites",...setup);
  }

  protected get fieldConverters(){
    return {
      'sequence.volume':toSingleDecimalNumber,
      'sequence.playbackSpeed':toSingleDecimalNumber,
      'sequence.length':toSingleDecimalNumber,
      'sequence.visibleRange.x': toSingleDecimalNumber,
      'sequence.visibleRange.y': toSingleDecimalNumber,
      'sequence.backdropXOffset': toSingleDecimalNumber,
      'sequence.backdropYOffset': toSingleDecimalNumber,
      'sequence.tracks.*.keyframes.Keyframes.*.Key': toSingleDecimalNumber,
      'sequence.tracks.*.keyframes.Keyframes.*.Length': toSingleDecimalNumber,
      'layers.*.opacity': toSingleDecimalNumber,
    };
  }

  get isSpine(){
    const frameId   = this.frameIds[0];
    const atlasPath = paths.join(this.yyDirAbsolute,`${frameId}.atlas`);
    return this.storage.exists(atlasPath);
  }

  get textureGroup(){
    return this.yyData.textureGroupId.name;
  }
  set textureGroup(name:string){
    this.yyData.textureGroupId.name = name;
    this.yyData.textureGroupId.path = `texturegroups/${name}`;
    this.save();
  }

  /** Get the array of current frameIds, in their frame order. */
  get frameIds(){
    return this.yyData.frames.map(frame=>frame.name);
  }

  set spriteType(type:SpriteType){
    this.yyData.type = type;
    this.save();
  }

  protected createYyFile(){
    // Create a frameless sprite template
    const firstLayerId = uuidV4();

    const yyData: YySprite = {
      ...yyDataDefaults,
      height: 0, // Set later based on subimages!
      width: 0,
      bbox_bottom: 0, // Should set later based on frame dims
      bbox_right: 0, // Should set later based on frame dims
      frames: [], // Add frames later based on subimages!
      layers: [
        {
          ...yyDataLayerDefaults,
          name: firstLayerId,
        }
      ],
      name: this.name,
      parent: Gms2Sprite.parentDefault,
      sequence: {
        ...yyDataSequenceDefaults,
        length: new NumberFixed(0), // Update with number of frames
        name: this.name,
        parent:  this.id,
        spriteId: this.id,
        tracks: [
          {
            ...yyDataSequenceTrackDefaults,
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
      textureGroupId: Gms2Sprite.textureGroupIdDefault,
      tags: [],
    };
    this.storage.writeJson(this.yyPathAbsolute,yyData);
  }

  /**
   * Set all yyData fields corresponding to height and width.
   * Must match the actual dims of the corresponding frames.
   * Adjust origin if the size has changed.
   */
  protected setDims(width:number,height:number){
    // Get the old height/width and origin for reference
    const oldOriginX = this.yyData.sequence.xorigin;
    const oldOriginY = this.yyData.sequence.yorigin;
    const oldHeight = this.yyData.height;
    const oldWidth = this.yyData.width;

    this.yyData.height = height;
    this.yyData.width = width;
    this.yyData.bbox_bottom = height;
    this.yyData.bbox_right = width;

    const originIsUnset = oldHeight == 0 || oldWidth == 0;
    const dimsHaveChanged = width!=oldWidth || height != oldHeight;
    if(originIsUnset){
      this.yyData.sequence.xorigin = Math.floor( width/2 );
      this.yyData.sequence.yorigin = Math.floor( height/2 );
    }
    else if(dimsHaveChanged){
      this.yyData.sequence.xorigin = Math.floor(oldOriginX/oldWidth  * width );
      this.yyData.sequence.yorigin = Math.floor(oldOriginY/oldHeight * height);
    }
    return this;
  }

  /** Force a layerId. Only updates the YY file, and only if there is only 1 layer. */
  setLayerId(layerId:string){
    assert(this.yyData.layers.length===1,"Cannot force the layerId if only one layer present.");
    this.yyData.layers[0].name = layerId;
    return this.save();
  }

  addFrame(imagePath:string,frameGuid:string){
    const keyFrames = this.yyData.sequence.tracks[0].keyframes.Keyframes;
    this.yyData.sequence.length = new NumberFixed(0);
    const framePath = paths.join(this.yyDirAbsolute,`${frameGuid}.png`);
    const frameLayerFolder = paths.join(this.yyDirAbsolute,'layers',frameGuid);
    const layerId = this.yyData.layers[0].name;
    const frameLayerImagePath = paths.join(frameLayerFolder,`${layerId}.png`);
    this.storage.ensureDir(frameLayerFolder);
    this.storage.copyFile(imagePath,framePath);
    this.storage.copyFile(imagePath,frameLayerImagePath);
    this.yyData.frames.push({
      compositeImage: {
        FrameId:{
          name: frameGuid,
          path: this.id.path
        },
        LayerId:null,
        resourceVersion:"1.0",
        name:"",
        tags: [],
        resourceType:"GMSpriteBitmap"
      },
      images: [{
        FrameId:{
          name: frameGuid,
          path: this.id.path
        },
        LayerId:{
          name: layerId,
          path: this.id.path
        },
        resourceVersion:"1.0",
        name:"",
        tags: [],
        resourceType:"GMSpriteBitmap"
      }],
      name: frameGuid,
      parent:this.id,
      resourceVersion:"1.0",
      tags:[],
      resourceType:"GMSpriteFrame"
    });
    keyFrames.push({
      id: uuidV4(),
      Key: new NumberFixed(this.yyData.frames.length),
      Length: new NumberFixed(1),
      Stretch: false,
      Disabled: false,
      IsCreationKey: false,
      Channels:{
        '0':{
          Id:{
            name: frameGuid,
            path: this.id.path
          },
          resourceVersion:"1.0",
          resourceType:"SpriteFrameKeyframe"
        }
      },
      resourceVersion:"1.0",
      resourceType:"Keyframe<SpriteFrameKeyframe>"
    });
    this.yyData.sequence.length = new NumberFixed(Number(this.yyData.sequence.length) + 1);
    return this.save();
  }

  clearFrames(){
    this.yyData.frames = [];
    this.yyData.sequence.tracks[0].keyframes.Keyframes = [];
    return this.save();
  }

  /**
   * Force the frames of this sprite to match the images
   * within a folder (non-recursive)
   */
  replaceFrames(spriteDirectory:string){
    const sprite = new Spritely(spriteDirectory);
    // Ensure that the sizes match
    this.setDims(sprite.width as number,sprite.height as number);
    // Replace all the frames

    // Replace all frames, but keep the existing IDs and ID
    // order where possible. (Minimizes useless git history changes.)
    const layersRoot = paths.join(this.yyDirAbsolute,'layers');
    this.storage.ensureDir(layersRoot);
    this.storage.emptyDir(layersRoot);
    const oldFrameIds = this.frameIds;
    const oldFrames = this.storage
      .listFiles(this.yyDirAbsolute,false,['png']);
    for(const frame of oldFrames){
      this.storage.deleteFile(frame);
    }

    this.clearFrames();
    // Add each new frame, updating the yyData as we go.
    for(const [i,subimagePath] of sprite.paths.entries()){
      this.addFrame(subimagePath,oldFrameIds[i] || uuidV4());
    }
    return this;
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
  static create(subimageDirectory:string,storage:Gms2Storage,spriteName?:string) {
    return new Gms2Sprite(spriteName||paths.subfolderName(subimageDirectory),storage,true)
      .replaceFrames(subimageDirectory);
  }

}
