import type { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import { bsArrayToArray, toArrayTag, toMoteTag } from './helpers.js';
import type { Mote } from './types.js';
import { capitalize } from './util.js';

export function stringifyQuest(
  mote: Mote<Crashlands2.Quest>,
  packed: GameChanger,
) {
  // METADATA
  const storyline = packed.working.getMote(mote.data.storyline);
  const blocks: string[] = [
    `Name: ${packed.working.getMoteName(mote)}`,
    `Storyline: ` +
      (storyline
        ? `${packed.working.getMoteName(storyline)}${toMoteTag(storyline)}`
        : ''),
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

  if (mote.data.quest_giver || mote.data.quest_receiver) {
    blocks.push('');
  }

  for (const momentType of ['start', 'end'] as const) {
    // REQUIREMENTS
    blocks.push(`${capitalize(momentType)} Requirements:`);
    const reqsFieldName = `quest_${momentType}_requirements` as const;
    const reqsData = mote.data[reqsFieldName];
    if (reqsData) {
      const reqs = bsArrayToArray(reqsData);
      for (const req of reqs) {
        if (req.element.style === 'Quest') {
          const quest = packed.working.getMote(req.element.quest);
          blocks.push(
            `?${toArrayTag(req)} ${req.element.style} ${
              req.element.quest_status
            }: ${packed.working.getMoteName(quest)}${toMoteTag(quest)}\n`,
          );
        } else {
          blocks.push(`?${toArrayTag(req)} ${req.element.style}\n`);
        }
      }
    } else {
      blocks.push('');
    }

    if (momentType === 'start') {
      // GIVER
      if (mote.data.quest_giver) {
        const giver = packed.working.getMote(mote.data.quest_giver.item);
        blocks.push(
          `Giver: ${packed.working.getMoteName(giver)}${toMoteTag(giver)}`,
        );
      }
    } else {
      // RECEIVER
      if (mote.data.quest_receiver) {
        const receiver = packed.working.getMote(mote.data.quest_receiver.item);
        blocks.push(
          `Receiver: ${packed.working.getMoteName(receiver)}${toMoteTag(
            receiver,
          )}`,
        );
      }
    }

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
      const momentContainers = bsArrayToArray(data);
      for (const momentContainer of momentContainers) {
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
          const emojiStr = emojiString(moment.speech.emotion);
          line += `>${toArrayTag(momentContainer)} ${
            emojiStr ? emojiStr + ' ' : ''
          }${moment.speech.text.text}`;
          lastSpeaker = moment.speech.speaker;
        } else if (moment.style === 'Emote') {
          const emojiLines: string[] = [`:)${toArrayTag(momentContainer)}`];
          for (const emote of bsArrayToArray(moment.emotes)) {
            if (!emote.element?.key) continue;
            emojiLines.push(
              `!${toArrayTag(emote)} ${characterString(
                emote.element?.key!,
              )} ${emojiString(emote.element?.value)}`,
            );
          }
          line += emojiLines.join('\n');
        } else {
          line += `?${toArrayTag(momentContainer)} ${moment.style}`;
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
      // Clues
      if (mote.data.clues) {
        const clueGroups = bsArrayToArray(mote.data.clues);
        for (const clueGroup of clueGroups) {
          if (!clueGroup.element?.phrases || !clueGroup.element.speaker)
            continue;
          const speaker = packed.working.getMote(clueGroup.element.speaker);
          let clueString = `Clue${toArrayTag(
            clueGroup,
          )}: ${packed.working.getMoteName(speaker)}${toMoteTag(
            clueGroup.element.speaker,
          )}`;
          for (const phraseContainer of bsArrayToArray(
            clueGroup.element!.phrases,
          )) {
            const clue = phraseContainer.element;
            let line = `\n>${toArrayTag(phraseContainer)} `;
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
    }
  }

  function emojiString(emojiId: string | undefined) {
    if (!emojiId) return '';
    const emoji = packed.working.getMote(emojiId);
    const name = packed.working.getMoteName(emoji) || emoji?.id || 'UNKNOWN';
    return name ? `(${name})` : '';
  }

  function characterString(characterId: string) {
    assert(characterId, 'Character ID must be defined');
    const character = packed.working.getMote(characterId);
    const name =
      packed.working.getMoteName(character) || character?.id || 'UNKNOWN';
    return name ? `${name.toUpperCase()}${toMoteTag(characterId)}` : '';
  }

  return blocks.join('\n') + '\n';
}
