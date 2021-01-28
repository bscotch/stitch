
/**
 * Structure of Spine 3.7.94 JSON file exports.
 */
export interface Spine {
  skeleton: {
    hash: string,
    /** Spine version */
    spine: string,
    /** Width of...? Not the atlas. Maybe canvas? */
    width: number,
    /** Height of...? Not the atlas. Maybe canvas? */
    height: number,
    fps: number,
    /** Path that image paths in rest of doc are relative to */
    images: string,
    /** Path that autdio paths in rest of doc are relative to */
    audio: string
  },
  bones: {
    name: string,
    parent?: string
  }[],
  slots: {
    name: "string",
    bone: "string",
    attachment: "string"
  }[],
  skins: {
    [name:string]:{
      [slot:string]:{
        [animationName:string]:{
          x: number,
          y: number,
          width: number,
          height: number
        }
      }
    }
  },
  events:{
    [eventName:string]:{
      /** Path to audio, relative to root skeleton.audio */
      audio?: string
    }
  },
  /** [NOT TYPED] */
  animations: any
}