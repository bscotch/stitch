import type { GameChanger } from './GameChanger.js';
import { characterString, emojiString } from './cl2.shared.stringify.js';
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

  // Moments
  blocks.push('Moments:');

  for (const moment of bsArrayToArray(mote.data.moments)) {
    // Format is \t#momentId#phraseId Speaker@moteId
    //           > phrase text
    // With a blank line between moments (but no blank line between phrases
    // in the same moment).
    blocks.push('');
    const phrases = bsArrayToArray(moment.element);
    if (!phrases.length) {
      // Then we still need to write the momentId so it doesn't get lost!
      blocks.push(`\t${toArrayTag(moment)}`);
    }
    for (const phrase of phrases) {
      const character = phrase.element.speaker
        ? characterString(phrase.element.speaker, packed)
        : '';
      const emoji = emojiString(phrase.element.emoji, packed);
      let asText = `\t${toArrayTag(moment)}${toArrayTag(phrase)} ${character}\n> `;
      if (emoji) {
        asText += `${emoji} `;
      }
      if (phrase.element.text?.text) {
        asText += phrase.element.text.text;
      }
      blocks.push(asText);
    }
  }

  return blocks.join('\n') + '\n';
}
