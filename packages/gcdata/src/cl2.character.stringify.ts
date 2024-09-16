import type { GameChanger } from './GameChanger.js';
import { emojiString } from './cl2.shared.stringify.js';
import type { CharacterMote } from './cl2.shared.types.js';
import { bsArrayToArray, toArrayTag } from './helpers.js';

export function stringifyCharacter(
  mote: CharacterMote,
  packed: GameChanger,
): string {
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
  blocks.push('Idle Dialogue:');

  if (mote.data.idle_text) {
    const idles = bsArrayToArray(mote.data.idle_text);
    for (const idle of idles) {
      // Each "Idle" consists of an internal "Topic" name,
      // and list of "Phrase Groups". Write out the topic with
      // its ID, like how we do Quest Clues.
      blocks.push(`\nTopic${toArrayTag(idle)}: ${idle.element.name}`);

      for (const phraseGroup of bsArrayToArray(idle.element.phrase_groups)) {
        // Each phrase group has an internal name and a list of
        // phrases. Treat it like Quest dialog, where the "speaker"
        // line is instead the name of the phrase group.
        blocks.push(
          `\n\t${phraseGroup.element.name}${toArrayTag(phraseGroup)}`,
        );
        for (const phrase of bsArrayToArray(phraseGroup.element.phrases)) {
          // Each phrase has an optional emoji and the text of the phrase.
          // Write it out like Quest dialog, with the phrase group as the speaker.
          const emojiStr = emojiString(phrase.element, packed);
          blocks.push(
            `>${toArrayTag(phrase)} ${
              emojiStr ? emojiStr + ' ' : ''
            }${phrase.element.text.text}`,
          );
        }
      }
    }
  }

  return blocks.join('\n') + '\n';
}
