import type { GameChanger } from './GameChanger.js';
import { type StorylineMote } from './cl2.storyline.types.js';
import { bsArrayToArray, toArrayTag } from './helpers.js';

export function stringifyStoryline(
  mote: StorylineMote,
  packed: GameChanger,
): string {
  // METADATA
  const blocks: string[] = [
    `Name: ${packed.working.getMoteName(mote)}`,
    `Description: ${mote.data.description?.text || ''}\n`,
  ];

  if (mote.data.wip?.staging) {
    blocks.push(`Stage: ${mote.data.wip.staging}\n`);
  } else {
    blocks.push('');
  }

  // NOTES
  if (mote.data.wip?.notes) {
    const comments = bsArrayToArray(mote.data.wip.notes);
    if (comments.length) {
      blocks.push(
        ...bsArrayToArray(mote.data.wip.notes).map(
          (c) => `//${toArrayTag(c.id)} ${c.element.text}`,
        ),
        '',
      );
    }
  }

  return blocks.join('\n');
}
