import type { NumberFixed } from '../lib/NumberFixed.js';
import type { YyBase } from './Yy';

export enum SoundChannel {
  Mono,
  Stereo,
  ThreeD,
}

export enum SoundCompression {
  Uncompressed,
  Compressed,
  UncompressedOnLoad,
  CompressedStreamed,
}

export type SoundChannelAsString = keyof typeof SoundChannel;
export type SoundCompressionAsString = keyof typeof SoundCompression;

enum SoundBitDepth {
  Bit8,
  Bit16,
}

export type SoundSampleRate = 5512 | 11025 | 22050 | 32000 | 44100 | 48000;

export interface YySound extends YyBase {
  /** Default 0. Compression level */
  compression: SoundCompression;
  /** Default 1. Number from 0-1 */
  volume: NumberFixed;
  preload: boolean;
  /** Default 128. Starting from 8, increments of 8, max of 512 */
  bitRate: number;
  /** Default 44100 */
  sampleRate: SoundSampleRate;
  /** Mono/stereo/3d */
  type: SoundChannel;
  /** Default 1 */
  bitDepth: SoundBitDepth;
  audioGroupId: {
    name: string;
    path: string;
  };
  /** `${name}.${ext} (e.g. mySound) */
  soundFile: string;
  duration: NumberFixed; // This can be safely deleted, which is great since we don't want to compute it
  resourceType: 'GMSound';
}
