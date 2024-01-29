// Generated by ts-to-zod
import { z } from 'zod';
import { yyBaseSchema } from './YyBase.js';
import { fixedNumber } from './utility.js';

export enum SoundBitDepth {
  Bit8,
  Bit16,
}
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

const soundChannelSchema = z.nativeEnum(SoundChannel);

const soundCompressionSchema = z.nativeEnum(SoundCompression);

const soundBitDepthSchema = z.nativeEnum(SoundBitDepth);

export type SoundChannelAsString = keyof typeof SoundChannel;
export type SoundCompressionAsString = keyof typeof SoundCompression;

export type SoundSampleRate = z.infer<typeof soundSampleRateSchema>;
const soundSampleRateSchema = z.union([
  z.literal(5512),
  z.literal(11025),
  z.literal(22050),
  z.literal(32000),
  z.literal(44100),
  z.literal(48000),
]);

export type YySound = z.infer<typeof yySoundSchema>;
export const yySoundSchema = yyBaseSchema.extend({
  compression: soundCompressionSchema.default(0),
  conversionMode: z.number().optional().default(0),
  volume: fixedNumber(z.number().min(0).max(1)).default(1),
  preload: z.boolean().default(false),
  bitRate: z.number().default(128),
  sampleRate: soundSampleRateSchema.default(44100),
  type: soundChannelSchema.default(1),
  bitDepth: soundBitDepthSchema.default(1),
  audioGroupId: z
    .object({
      name: z.string(),
      path: z.string(),
    })
    .default({
      name: 'audiogroup_default',
      path: 'audiogroups/audiogroup_default',
    }),
  /** `${name}.${ext} (e.g. mySound) */
  soundFile: z.string(),
  /**
   * Duration of the sound. Automatically
   * computed by GameMaker, so Stitch can generally
   * ignore it.
   */
  duration: fixedNumber(z.number(), 2).optional(),
  resourceType: z.literal('GMSound').default('GMSound'),
});
