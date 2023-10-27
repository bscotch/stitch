import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import { bsArrayToArray } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import type { Mote } from './types.js';
import { capitalize } from './util.js';

export function stringifyMote(mote: Mote<Crashlands2.Quest>, packed: Packed) {
  const storyline = packed.getMote(mote.data.storyline);

  // METADATA
  const blocks: string[] = [
    `Name: ${packed.getMoteName(mote)}`,
    `Storyline: ${packed.getMoteName(storyline)}${moteTag(storyline)}`,
    `Draft: ${mote.data.wip?.draft || 'false'}\n`,
  ];

  // NOTES
  if (mote.data.wip?.comments) {
    const comments = bsArrayToArray(mote.data.wip.comments);
    if (comments.length) {
      blocks.push(
        ...bsArrayToArray(mote.data.wip.comments).map(
          (c) => `//${arrayTag(c.id)} ${c.element}`,
        ),
        '',
      );
    }
  }

  // GIVER
  if (mote.data.quest_giver) {
    const giver = packed.getMote(mote.data.quest_giver.item);
    blocks.push(`Giver: ${packed.getMoteName(giver)}${moteTag(giver)}`);
  }
  // RECEIVER
  if (mote.data.quest_receiver) {
    const receiver = packed.getMote(mote.data.quest_receiver.item);
    blocks.push(
      `Receiver: ${packed.getMoteName(receiver)}${moteTag(receiver)}`,
    );
  }

  if (mote.data.quest_giver || mote.data.quest_receiver) {
    blocks.push('');
  }

  // Clues
  if (mote.data.clues) {
    const clueGroups = bsArrayToArray(mote.data.clues);
    for (const clueGroup of clueGroups) {
      if (!clueGroup.element?.phrases || !clueGroup.element.speaker) continue;
      const speaker = packed.getMote(clueGroup.element.speaker);
      let clueString = `Clue${arrayTag(clueGroup)}: ${packed.getMoteName(
        speaker,
      )}${moteTag(clueGroup.element.speaker)}`;
      for (const phraseContainer of bsArrayToArray(
        clueGroup.element!.phrases,
      )) {
        const clue = phraseContainer.element;
        let line = `\n>${arrayTag(phraseContainer)} `;
        const emoji = clue?.phrase.emoji;
        if (emoji) {
          line += `(${emoji}) `;
        }
        line += clue?.phrase.text.text || '';
        clueString += line;
      }
      blocks.push(clueString);
    }
    if (clueGroups.length) {
      blocks.push('');
    }
  }

  for (const momentType of ['start', 'end'] as const) {
    // MOMENTS
    blocks.push(`${capitalize(momentType)} Moments:`);
    const fieldName = `quest_${momentType}_moments` as const;
    const data = mote.data[fieldName];
    if (data) {
      /**
       * Track the last speaker so we can collapse sequential dialog
       * from the same speaker
       */
      let lastSpeaker: string | undefined;

      for (const momentContainer of bsArrayToArray(data)) {
        const moment = momentContainer.element!;
        let line = '';

        if (moment.style !== 'Dialogue') {
          lastSpeaker = undefined;
        }

        if (moment.style === 'Dialogue') {
          // Speaker and dialog line
          if (moment.speech.speaker !== lastSpeaker) {
            line += `\t${characterString(moment.speech.speaker)}\n`;
          }
          line += `>${arrayTag(momentContainer)} ${emojiString(
            moment.speech.emotion,
          )}${moment.speech.text.text}`;
          lastSpeaker = moment.speech.speaker;
        } else if (moment.style === 'Emote') {
          const emojiLines: string[] = [`:)${arrayTag(momentContainer)}`];
          for (const emote of bsArrayToArray(moment.emotes)) {
            emojiLines.push(
              `!${arrayTag(emote)} ${characterString(
                emote.element?.key!,
              )} ${emojiString(emote.element?.value)}`,
            );
          }
          line += emojiLines.join('\n');
        } else {
          line += `?${arrayTag(momentContainer)} ${moment.style}`;
        }
        blocks.push(line + '\n');
      }
    } else {
      blocks.push('');
    }

    if (momentType === 'start') {
      // Start Log
      if (mote.data.quest_start_log) {
        blocks.push(`Log: ${mote.data.quest_start_log.text}`, '');
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
    return name ? `${name.toUpperCase()}${moteTag(characterId)}` : '';
  }

  return blocks.join('\n') + '\n';
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
