import type { GameChanger } from './GameChanger.js';
import type { ChatMote } from './cl2.shared.types.js';
import { bsArrayToArray, toArrayTag } from './helpers.js';

export function stringifyChat(mote: ChatMote, packed: GameChanger): string {
  // METADATA
  const blocks: string[] = [`Name: ${packed.working.getMoteName(mote)}`];
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

  // IDLE DIALOGUE
  blocks.push('Moments:');

  return blocks.join('\n') + '\n';
}
