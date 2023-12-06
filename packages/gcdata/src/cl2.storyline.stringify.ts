import type { GameChanger } from './GameChanger.js';
import { type StorylineMote } from './cl2.storyline.types.js';
import { bsArrayToArray, toArrayTag } from './helpers.js';

export function stringifyStoryline(
  mote: StorylineMote,
  packed: GameChanger,
): string {
  const name = packed.working.getMoteName(mote);
  const description = mote.data.description;

  // METADATA
  const blocks: string[] = [
    `Name: ${packed.working.getMoteName(mote)}`,
    `Description: ${mote.data.description?.text || ''}\n`,
    `Draft: ${mote.data.wip?.draft ? 'true' : 'false'}\n`,
  ];

  // NOTES
  if (mote.data.wip?.comments) {
    const comments = bsArrayToArray(mote.data.wip.comments);
    if (comments.length) {
      blocks.push(
        ...bsArrayToArray(mote.data.wip.comments).map(
          (c) => `//${toArrayTag(c.id)} ${c.element}`,
        ),
        '',
      );
    }
  }

  return blocks.join('\n');
}
