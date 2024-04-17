import type { GameChanger } from './GameChanger.js';
import { type StorylineMote } from './cl2.storyline.types.js';

export function stringifyStoryline(
  mote: StorylineMote,
  packed: GameChanger,
): string {
  // METADATA
  const blocks: string[] = [
    `Name: ${packed.working.getMoteName(mote)}`,
    `Description: ${mote.data.description?.text || ''}\n`,
  ];
  return blocks.join('\n');
}
