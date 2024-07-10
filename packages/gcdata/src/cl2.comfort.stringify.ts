import { ComfortMote } from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { bsArrayToArray, toArrayTag } from './helpers.js';
import { cleanGameChangerString } from './util.js';

export function stringifyComfort(
  mote: ComfortMote,
  packed: GameChanger,
): string {
  // METADATA
  const blocks: string[] = [
    `Name: ${cleanGameChangerString(packed.working.getMoteName(mote))}`,
    `Description: ${cleanGameChangerString(mote.data.description?.text)}\n`,
    `Unlocked Description: ${cleanGameChangerString(
      mote.data.unlocked_description?.text,
    )}\n`,
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
