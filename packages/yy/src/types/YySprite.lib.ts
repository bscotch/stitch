import { pointable } from '@bscotch/utility';
import { PartialDeep } from 'type-fest';
import { v4 as uuidV4 } from 'uuid';
import { getYyResourceId } from './utility.js';
import { YySprite } from './YySprite.js';

export function ensureTrackKeyFrames(
  sprite: PartialDeep<YySprite, { recurseIntoArrays: true }>,
) {
  const spriteId = getYyResourceId('sprites', sprite.name!);
  const frames = sprite.frames;
  const spritePointable = pointable(sprite);
  if (frames) {
    const keyframes = spritePointable
      .at(['sequence', 'tracks', 0, 'keyframes', 'Keyframes'])
      .set([], {
        createMissing: true,
        noClobber: true,
      });
    for (let i = 0; i < frames.length; i++) {
      const frame = pointable(frames).at([i]).set({}, { noClobber: true })!;
      frame.name ||= uuidV4();
      if (keyframes.length <= i) {
        keyframes.push({} as any);
      }
      const keyframe = keyframes[i]!;
      // Make sure that the Channels value is an object since
      // it uses numeric string indexes (which confuses JSON Pointers)
      const keyframePointable = pointable(keyframe);
      keyframePointable.at('/Channels').set({}, { noClobber: true });
      keyframePointable
        .at(['Channels', '0', 'Id', 'name'])
        .set(frame.name, { noClobber: true, createMissing: true });
      keyframePointable
        .at(['Channels', '0', 'Id', 'path'])
        .set(spriteId.path, { noClobber: true });
    }
  }
  return sprite;
}
