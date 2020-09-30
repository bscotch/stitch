
export interface YyData {
  ConfigValues?:{[configName:string]:{[field:string]:string}}
  name: string,
  resourceType: string,
  tags: string[],
  /** Parent folder */
  parent: {
    /** Folder's 'name' field */
    name: string,
    /** Folder's 'folderPath' field */
    path: string,
  },
  resourceVersion: "1.0" // constant
}

export interface YyScript extends YyData {
  isDnD: false,
  isCompatibility: false,
  resourceType: "GMScript"
}

enum SoundChannel {
  Mono,
  Stereo,
  ThreeD
}

enum SoundCompression {
  Uncompressed,
  Compressed,
  UncompressedOnLoad,
  CompressedStreamed,
}

enum SoundBitDepth {
  Bit8,
  Bit16
}

export interface YySound extends YyData {
  /** Default 0. Compression level */
  compression: SoundCompression,
  /** Default 1. Number from 0-1 */
  volume: number,
  preload: boolean,
  /** Default 128. Starting from 8, increments of 8, max of 512 */
  bitRate: number,
  /** Default 44100 */
  sampleRate: 5512 | 11025 | 22050 | 32000 | 44100 | 48000,
  /** Mono/stereo/3d */
  type: SoundChannel,
  /** Default 1 */
  bitDepth: SoundBitDepth,
  audioGroupId: {
    name: string,
    path: string,
  },
  /** `${name}.${ext} (e.g. mySound) */
  soundFile: string,
  // duration: number, // This can be safely deleted, which is great since we don't want to compute it
  resourceType: "GMSound",
}

export enum SpriteCollisionKind {
  Precise,
  Rectangle,
  Ellipse,
  Diamond,
  PrecisePerFrame,
  RectangleWithRotation,
}

export enum SpriteBoundingBoxMode {
  Automatic,
  FullImage,
  Manual,
}

export enum SpriteOrigin {
  TopLeft,
  TopCenter,
  TopRight,
  MiddleLeft,
  MiddleCenter,
  MiddleRight,
  BottomLeft,
  BottomCenter,
  BottomRight
}

export enum SpritePlaybackSpeedType {
  FramesPerSecond,
  FramesPerGameFrame,
}

interface SpriteImage {
  FrameId:{
    name: string,
    /** Path to the sprite's .yy file */
    path:string
  },
  LayerId:{
    /**
     * Name of the layer. Corresponds to an image in each layer folder,
     * and should be found in once in *each frame*. Must be found in the
     * sprite's root "layers" list.
     */
    name:string,
    /** Path to the sprite's .yy file */
    path:string
  },
  resourceVersion:"1.0",
  name:"",
  /** An empty array (there seems to be no way to add tags to frames) */
  tags:[],
  resourceType:"GMSpriteBitmap"
}

interface SpriteCompositeImage extends Omit<SpriteImage,'LayerId'|'name'> {
  LayerId:null,
  name:"composite",
}

interface SpriteFrame {
  /** Image created by flattening layers. */
  compositeImage: SpriteCompositeImage,
  /** One image per layer. */
  images: SpriteImage[],
  /** The parent sprite, same as the sprite's ID from the YYP. */
  parent:{
    name:string,
    path:string
  },
  resourceVersion:"1.0",
  /**
   * Unique GUID. Matches the name of an image file (+'.png')
   * that sits alongside the .yy file. Also matches a corresponding
   * folder name inside the "layers" folder. The Composite image
   * and each one listed in 'images' all have the same value here
   * for their "FrameId.name" field.
   */
  name:string,
  tags:[],
  resourceType:"GMSpriteFrame"
}

interface SpriteLayer {
  /** (Default true) */
  visible:boolean,
  /** (Default false) */
  isLocked:boolean,
  /** (What is this? Enum?) */
  blendMode:0,
  /** (What is this? Range?) */
  opacity:100.0,
  /** ("default" for the base layer) */
  displayName:string,
  resourceVersion:"1.0",
  /** The unique GUID for this layer, used by Frames in their LayerId field. */
  name:string,
  /** Seems to be unused -- always an empty array. */
  tags:[],
  resourceType:"GMImageLayer"
}

interface SpriteSequence {
  /** Matches the YYP resource's 'id' value */
  spriteId: {
    name:string,
    path:string
  },
  /** (Default 1) What is this? */
  timeUnits: 1,
  /** (Default 1) What is this? */
  playback: 1,
  /** FPS (probably 30, 45, or 60) */
  playbackSpeed: number,
  playbackSpeedType: SpritePlaybackSpeedType,
  /** (Default true) What is this? */
  autoRecord: true,
  volume: 1.0,
  length: 2.0,
  events: {"Keyframes":[],"resourceVersion":"1.0","resourceType":"KeyframeStore<MessageEventKeyframe>",},
  moments: {"Keyframes":[],"resourceVersion":"1.0","resourceType":"KeyframeStore<MomentsEventKeyframe>",},
  tracks: [
    {"name":"frames","spriteId":null,"keyframes":{"Keyframes":[
      {"id":"c49cf451-e332-4284-88ad-605b9b54c139","Key":0.0,"Length":1.0,"Stretch":false,"Disabled":false,"IsCreationKey":false,"Channels":{"0":{"Id":{"name":"98c41232-eb8d-41fc-a6d9-156eafb4d651","path":"sprites/sprite/sprite.yy",},"resourceVersion":"1.0","resourceType":"SpriteFrameKeyframe",},},"resourceVersion":"1.0","resourceType":"Keyframe<SpriteFrameKeyframe>",},
      {"id":"ea220aa2-106b-4e02-a07f-286e4079a42b","Key":1.0,"Length":1.0,"Stretch":false,"Disabled":false,"IsCreationKey":false,"Channels":{"0":{"Id":{"name":"34126976-a5d5-4f2a-988b-384c47e1f81e","path":"sprites/sprite/sprite.yy",},"resourceVersion":"1.0","resourceType":"SpriteFrameKeyframe",},},"resourceVersion":"1.0","resourceType":"Keyframe<SpriteFrameKeyframe>",},
    ],"resourceVersion":"1.0","resourceType":"KeyframeStore<SpriteFrameKeyframe>",},"trackColour":0,"inheritsTrackColour":true,"builtinName":0,"traits":0,"interpolation":1,"tracks":[],"events":[],"modifiers":[],"isCreationTrack":false,"resourceVersion":"1.0","tags":[],"resourceType":"GMSpriteFramesTrack",},
  ],
  visibleRange: null,
  lockOrigin: false,
  showBackdrop: true,
  showBackdropImage: false,
  backdropImagePath: "",
  backdropImageOpacity: 0.5,
  backdropWidth: 1366,
  backdropHeight: 768,
  backdropXOffset: 0.0,
  backdropYOffset: 0.0,
  xorigin: 32,
  yorigin: 32,
  eventToFunction: {},
  eventStubScript: null,
  parent: {"name":"sprite","path":"sprites/sprite/sprite.yy",},
  resourceVersion: "1.3",
  name: "sprite",
  tags: [],
  resourceType: "GMSequence",
}

/**
 * Data structure for Sprite .yy files.
 * **Note:** We aren't populating the full
 * type until we need to create Sprites.
 * Until then, we can just include fields
 * as needed for editing existing sprites.
 */
export interface YySprite extends YyData {
  bboxMode: SpriteBoundingBoxMode,
  collisionKind: SpriteCollisionKind,
  /** (What is this?) */
  type: 0,
  origin: SpriteOrigin,
  /** (Default true.) */
  preMultiplyAlpha: boolean,
  /** (Default true.) */
  edgeFiltering: boolean,
  /** 0-255. Only meaningful if collision type is "Precise". */
  collisionTolerance: number,
  /** (What is this?) */
  swfPrecision: 2.525,
  bbox_left: number,
  bbox_right: number,
  bbox_top: number,
  bbox_bottom: number,
  /** (Default false.) Horizontally tiled */
  HTile: boolean,
  /** (Default false.) Vertically tiled */
  VTile: boolean,
  /** (Default false.) Used for 3d (not sure how set...) */
  For3D: boolean,
  width: number,
  height: number,
  /** Matches the texture's id from the YYP file */
  textureGroupId: {
    /** the name of the Texture Group */
    name: string,
    /** seems to just be `texturegroups/${name}` */
    path: string,
  },
  /** (What is this?) */
  swatchColours: null,
  /** (What is this?) */
  gridX: 0,
  /** (What is this?) */
  gridY: 0,
  frames: SpriteFrame[],
  sequence: SpriteSequence,
  layers: SpriteLayer[],
  resourceType: "GMSprite"
}