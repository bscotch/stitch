import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import { bsArrayToArray } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import type { Mote } from './types.js';

export function questMoteToText(mote: Mote<Crashlands2.Quest>, packed: Packed) {
  const emojis =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_emoji']>('cl2_emoji');
  const storyline = packed.getMote(mote.data.storyline);

  // METADATA

  const blocks: string[] = [
    `NAME: ${packed.getMoteName(mote)}`,
    `STORYLINE: ${packed.getMoteName(storyline)} ${moteTag(storyline)}`,
  ];

  if (mote.data.wip?.draft) {
    blocks.push(`DRAFT: true`);
  }

  if (mote.data.wip?.comments) {
    for (const comment of bsArrayToArray(mote.data.wip.comments)) {
      blocks.push(`// ${comment.element} ${arrayTag(comment)}`);
    }
  }

  // INITIALIZATION

  // Giver
  if (mote.data.quest_giver) {
    const giver = packed.getMote(mote.data.quest_giver.item);
    blocks.push(`GIVER: ${packed.getMoteName(giver)} ${moteTag(giver)}`);
  }
  // Receiver
  if (mote.data.quest_receiver) {
    const receiver = packed.getMote(mote.data.quest_receiver.item);
    blocks.push(
      `RECEIVER: ${packed.getMoteName(receiver)} ${moteTag(receiver)}`,
    );
  }

  // Clues
  if (mote.data.clues) {
    for (const clueGroup of bsArrayToArray(mote.data.clues)) {
      if (!clueGroup.element?.phrases || !clueGroup.element.speaker) continue;
      const speaker = packed.getMote(clueGroup.element.speaker);
      let clueString = `CLUE ${arrayTag(clueGroup)}: ${packed.getMoteName(
        speaker,
      )} ${moteTag(clueGroup.element.speaker)}`;
      for (const phraseContainer of bsArrayToArray(
        clueGroup.element!.phrases,
      )) {
        const clue = phraseContainer.element;
        let line = '\n> ';
        const emoji = clue?.phrase.emoji;
        if (emoji) {
          line += `(${emoji}) `;
        }
        line += clue?.phrase.text.text || '';
        line += ` ${arrayTag(phraseContainer)}`;
        clueString += line;
      }
      blocks.push(clueString);
    }
  }

  for (const momentType of ['start', 'end'] as const) {
    blocks.push(`${momentType.toUpperCase()} MOMENTS:`);
    const fieldName = `quest_${momentType}_moments` as const;
    const data = mote.data[fieldName];
    if (data) {
      for (const momentContainer of bsArrayToArray(data)) {
        const moment = momentContainer.element!;
        let line = '';
        let reqs = '';
        if ('requirements' in moment) {
          for (const reqContainer of bsArrayToArray(moment?.requirements!)) {
            const req = reqContainer.element;
            reqs += `\n? ${req?.style || 'Unknown'} ${arrayTag(reqContainer)}`;
          }
        }

        if (moment.style === 'Dialogue') {
          // Speaker and dialog line
          line += `\t${characterString(moment.speech.speaker)}\n> ${emojiString(
            moment.speech.emotion,
          )}${moment.speech.text.text} ${arrayTag(momentContainer)}`;
        } else if (moment.style === 'Emote') {
          const emojiLines: string[] = [`:) ${arrayTag(momentContainer)}`];
          for (const emote of bsArrayToArray(moment.emotes)) {
            emojiLines.push(
              `! ${emojiString(emote.element?.value)}${characterString(
                emote.element?.key!,
              )} ${arrayTag(emote)}`,
            );
          }
          line += emojiLines.join('\n');
        } else {
          line += `${moment.style} ${arrayTag(momentContainer)}`;
        }
        blocks.push(line + reqs);
      }
    }
  }

  function emojiString(emojiId: string | undefined) {
    if (!emojiId) return '';
    const emoji = packed.getMote(emojiId);
    const name = packed.getMoteName(emoji) || emoji.id;
    return name ? `(${name}) ` : '';
  }

  function characterString(characterId: string) {
    const character = packed.getMote(characterId);
    const name = packed.getMoteName(character) || character.id;
    return name ? `${name} ${moteTag(characterId)}` : '';
  }

  return blocks.join('\n\n') + '\n';
}

function moteTag(item: string | { id: string }): string {
  assert(
    typeof item === 'string' || 'id' in item,
    'ID must be a string or Mote',
  );
  const idStr = typeof item === 'string' ? item : item.id;
  return `@${idStr}`;
}

function arrayTag(item: string | { id: string }): string {
  assert(
    typeof item === 'string' || 'id' in item,
    'ID must be a string or Mote',
  );
  const idStr = typeof item === 'string' ? item : item.id;
  return `#${idStr}`;
}
