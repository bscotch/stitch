import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import { bsArrayToArray } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import type { Mote } from './types.js';
import { capitalize } from './util.js';

export function questMoteToText(mote: Mote<Crashlands2.Quest>, packed: Packed) {
  const emojis =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_emoji']>('cl2_emoji');
  const storyline = packed.getMote(mote.data.storyline);

  // METADATA
  const blocks: string[] = [];

  const metadata: string[] = [
    `Name: ${packed.getMoteName(mote)}`,
    `Storyline: ${packed.getMoteName(storyline)} ${moteTag(storyline)}`,
  ];

  if (mote.data.wip?.draft) {
    metadata.push(`Draft: true`);
  }

  // NOTES
  if (mote.data.wip?.comments) {
    for (const comment of bsArrayToArray(mote.data.wip.comments)) {
      metadata.push(`Note${arrayTag(comment)}: ${comment.element}`);
    }
  }

  // INITIALIZATION

  // Giver
  if (mote.data.quest_giver) {
    const giver = packed.getMote(mote.data.quest_giver.item);
    metadata.push(`Giver: ${packed.getMoteName(giver)} ${moteTag(giver)}`);
  }
  // Receiver
  if (mote.data.quest_receiver) {
    const receiver = packed.getMote(mote.data.quest_receiver.item);
    metadata.push(
      `Receiver: ${packed.getMoteName(receiver)} ${moteTag(receiver)}`,
    );
  }

  blocks.push(metadata.join('\n'));

  // Start Log
  if (mote.data.quest_start_log) {
    blocks.push(`Log: ${mote.data.quest_start_log.text}`);
  }

  // Objectives
  blocks.push('Objectives:');
  if (mote.data.objectives) {
    // For now just get them in there with their ID and style
    for (const objective of bsArrayToArray(mote.data.objectives)) {
      blocks.push(
        `-${arrayTag(objective)} ${objective.element?.style || 'Unknown'}`,
      );
    }
  }

  // Clues
  if (mote.data.clues) {
    for (const clueGroup of bsArrayToArray(mote.data.clues)) {
      if (!clueGroup.element?.phrases || !clueGroup.element.speaker) continue;
      const speaker = packed.getMote(clueGroup.element.speaker);
      let clueString = `Clue${arrayTag(clueGroup)}: ${packed.getMoteName(
        speaker,
      )} ${moteTag(clueGroup.element.speaker)}`;
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
  }

  for (const momentType of ['start', 'end'] as const) {
    // REQUIREMENTS
    blocks.push(`${capitalize(momentType)} Requirements:`);
    const reqFieldName = `quest_${momentType}_requirements` as const;
    const reqData = mote.data[reqFieldName];
    if (reqData) {
      for (const reqContainer of bsArrayToArray(reqData)) {
        const req = reqContainer.element;
        let line = `?${arrayTag(reqContainer)} ${req?.style || 'Unknown'}`;
        if (req?.style === 'Quest') {
          line += `: ${packed.getMoteName(req.quest)} ${moteTag(req.quest)}`;
        }
        blocks.push(line);
      }
    }

    // MOMENTS
    blocks.push(`${capitalize(momentType)} Moments:`);
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
            reqs += `\n?${arrayTag(reqContainer)} ${req?.style || 'Unknown'}`;
            if (req?.style === 'Quest') {
              reqs += `: ${packed.getMoteName(req.quest)} ${moteTag(
                req.quest,
              )}`;
            }
          }
        }

        if (moment.style === 'Dialogue') {
          // Speaker and dialog line
          line += `\t${characterString(moment.speech.speaker)}\n>${arrayTag(
            momentContainer,
          )} ${emojiString(moment.speech.emotion)}${moment.speech.text.text}`;
        } else if (moment.style === 'Emote') {
          const emojiLines: string[] = [`:)${arrayTag(momentContainer)}`];
          for (const emote of bsArrayToArray(moment.emotes)) {
            emojiLines.push(
              `!${arrayTag(emote)} ${emojiString(
                emote.element?.value,
              )}${characterString(emote.element?.key!)}`,
            );
          }
          line += emojiLines.join('\n');
        } else if (moment.style === 'Gain Item') {
          line += `Gain Item${arrayTag(momentContainer)}:\n`;
          const itemLines: string[] = [];
          for (const item of bsArrayToArray(moment.items)) {
            // key is the moteId for the item, value is the quantity
            const itemName = packed.getMoteName(item.element?.key!);
            // Note: Can probably skip the array tag since we can use the item moteId as the unique identifier for diffs
            itemLines.push(
              `+${item.element?.value || 1} ${itemName} ${moteTag(
                item.element?.key!,
              )}`,
            );
          }
          line += itemLines.join('\n');
        } else if (moment.style === 'Drop Item') {
          // The "dropper" is a moteId. Technically we can have multiple droppers, but that'll be pretty rare so we can just duplicate the first line each time if necessary.
          const dropGroups: string[] = [];
          for (const dropGroup of bsArrayToArray(moment.drops)) {
            const dropper = packed.getMote(dropGroup.element?.dropper!);
            const dropperName = packed.getMoteName(dropper);
            let dropText = `Drop Item${arrayTag(
              momentContainer,
            )}: ${dropperName} ${moteTag(dropper)}`;
            for (const item of bsArrayToArray(dropGroup.element?.items!)) {
              const itemName = packed.getMoteName(item.element?.item_id!);
              // Note: Can probably skip the array tag since we can use the item moteId as the unique identifier for diffs
              dropText += `\n+${
                item.element?.quantity || 1
              } ${itemName} ${moteTag(item.element?.item_id!)}`;
            }
            dropGroups.push(dropText);
          }
          line += dropGroups.join('\n\n');
        } else {
          line += `${moment.style}${arrayTag(momentContainer)}: Not Editable`;
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
    return name ? `${name.toUpperCase()} ${moteTag(characterId)}` : '';
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
