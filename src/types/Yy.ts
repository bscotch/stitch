
export interface YyBase {
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

export interface YyScript extends YyBase {
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

export interface YySound extends YyBase {
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
