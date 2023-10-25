import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import {
  ParsedLine,
  QuestUpdateResult,
  Section,
  getPointerForLabel,
  lineIsArrayItem,
  linePatterns,
  parseIfMatch,
} from './cl2.quest.types.js';
import { getAllowedSpeakers } from './cl2.quest.utils.js';
import { bsArrayToArray, createBsArrayKey } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import { Range } from './types.editor.js';
import type { Bschema, Mote } from './types.js';
import { capitalize, resolvePointerInSchema } from './util.js';
export type { QuestUpdateResult } from './cl2.quest.types.js';

export function questTextToMote(
  text: string,
  mote: Mote<Crashlands2.Quest>,
  packed: Packed,
): QuestUpdateResult {
  const allowedSpeakerIds = getAllowedSpeakers(packed);
  assert(
    allowedSpeakerIds.length > 0,
    'Should have at least one allowed speaker mote',
  );

  /**
   * Shared list of keywords that can be used at the start of any line,
   * with required-unique entries removed when found.
   */
  const nonUniqueGlobalLabels = new Set<string>(['Clue', 'Note']);
  const availableGlobalLabels = new Set<string>([
    'Draft',
    'Name',
    'Storyline',
    'Giver',
    'Receiver',
    'Note',
    'Clue',
    'Start Requirements',
    'Start Moments',
    'End Requirements',
    'End Moments',
    'Log',
    'Objectives',
  ]);

  const result: QuestUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
  };

  const lines = text.split(/(\r?\n)/g);
  let index = 0;
  let lineNumber = 0;

  const addHover = (range: Range, subschema: Bschema | undefined) => {
    if (subschema?.title || subschema?.description) {
      result.hovers.push({
        ...range,
        title: subschema.title,
        description: subschema.description,
      });
    }
  };

  /** The lowercased name of the section we're in. If `undefined` we're in the root. */
  let section: Section | undefined;

  for (const line of lines) {
    // Is this just a newline?
    if (line.match(/\r?\n/)) {
      // Then we just need to increment the index
      index += line.length;
      lineNumber++;
      continue;
    }

    // Is this just a blank line?
    if (!line) {
      // Add global autocompletes
      result.completions.push({
        type: 'labels',
        start: { index, line: lineNumber, character: 0 },
        end: { index, line: lineNumber, character: 0 },
        options: availableGlobalLabels,
      });
      continue;
    }

    // Find the first matching pattern and pull the values
    // from it.
    let parsedLine: null | ParsedLine = null;
    for (const pattern of linePatterns) {
      parsedLine = parseIfMatch(pattern, line, {
        index,
        line: lineNumber,
        character: 0,
      });
      if (parsedLine) break;
    }
    if (!parsedLine) {
      result.diagnostics.push({
        message: `Unfamiliar syntax: ${line}`,
        start: { index, line: lineNumber, character: 0 },
        end: {
          index: index + line.length,
          line: lineNumber,
          character: line.length,
        },
      });
      index += line.length;
      continue;
    }

    // Ensure the array tag. It goes right after the label or indicator.
    if (!parsedLine.arrayTag?.value && lineIsArrayItem(line)) {
      const arrayTag = createBsArrayKey();
      const start = parsedLine.indicator?.end || parsedLine.label?.end!;
      result.edits.push({
        start,
        end: start,
        newText: `#${arrayTag}`,
      });
      parsedLine.arrayTag = {
        start,
        end: start,
        value: arrayTag,
      };
    }

    // If this has a label, remove it from the list of available labels
    if (
      parsedLine.label?.value &&
      availableGlobalLabels.has(parsedLine.label.value) &&
      !nonUniqueGlobalLabels.has(parsedLine.label.value)
    ) {
      availableGlobalLabels.delete(parsedLine.label.value);
    }

    // Figure out what data/subschema is represented by this line
    const labelLower = parsedLine.label?.value?.toLowerCase();
    if (parsedLine.indicator?.value === '\t') {
      // Then this is a dialog speaker line
      // If there's no speaker, add an autocomplete
      if (!parsedLine.moteName) {
        result.completions.push({
          type: 'motes',
          start: parsedLine.indicator.end,
          end: parsedLine.indicator.end,
          options: allowedSpeakerIds,
        });
      }
    } else if (labelLower) {
      const pointer = getPointerForLabel(
        labelLower,
        parsedLine.arrayTag?.value,
      );
      let subschema: Bschema | undefined;
      if (pointer) {
        // Then we're in a new "section"
        section = labelLower as Section;
        subschema = resolvePointerInSchema(pointer, mote, packed);
        assert(subschema, `No subschema found for pointer ${pointer}`);
        addHover(parsedLine.label!, subschema);
      } else {
        // Then based on the section we're in we'll have different needs
        subschema = resolvePointerInSchema(
          [
            ...getPointerForLabel(section!, undefined)!,
            parsedLine.arrayTag?.value || createBsArrayKey(),
            'element',
          ],
          mote,
          packed,
        );
      }
      assert(subschema, `No subschema found for pointer ${pointer}`);
      addHover(parsedLine.label!, subschema);
    } else {
      // Then this is an "indicator" line. Indicators are prefixes that identify the kind of thing we're dealing with. Some of them are unambiguous, others require knowing what section we're in.
    }

    index += line.length;
  }

  return result;
}

export function questMoteToText(mote: Mote<Crashlands2.Quest>, packed: Packed) {
  const storyline = packed.getMote(mote.data.storyline);

  // METADATA
  const blocks: string[] = [];

  const metadata: string[] = [
    `Name: ${packed.getMoteName(mote)}`,
    `Storyline: ${packed.getMoteName(storyline)}${moteTag(storyline)}`,
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
    metadata.push(`Giver: ${packed.getMoteName(giver)}${moteTag(giver)}`);
  }
  // Receiver
  if (mote.data.quest_receiver) {
    const receiver = packed.getMote(mote.data.quest_receiver.item);
    metadata.push(
      `Receiver: ${packed.getMoteName(receiver)}${moteTag(receiver)}`,
    );
  }

  blocks.push(metadata.join('\n'));

  // Clues
  if (mote.data.clues) {
    for (const clueGroup of bsArrayToArray(mote.data.clues)) {
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
          line += `: ${packed.getMoteName(req.quest)}${moteTag(req.quest)}`;
        }
        blocks.push(line);
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

      for (const momentContainer of bsArrayToArray(data)) {
        const moment = momentContainer.element!;
        let line = '';
        let reqs = '';
        if ('requirements' in moment) {
          for (const reqContainer of bsArrayToArray(moment?.requirements!)) {
            const req = reqContainer.element;
            reqs += `\n?${arrayTag(reqContainer)} ${req?.style || 'Unknown'}`;
            if (req?.style === 'Quest') {
              reqs += `: ${packed.getMoteName(req.quest)}${moteTag(req.quest)}`;
            }
          }
        }

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
        } else if (moment.style === 'Gain Item') {
          line += `Gain Item${arrayTag(momentContainer)}:\n`;
          const itemLines: string[] = [];
          for (const item of bsArrayToArray(moment.items)) {
            // key is the moteId for the item, value is the quantity
            const itemName = packed.getMoteName(item.element?.key!);
            // Note: Can probably skip the array tag since we can use the item moteId as the unique identifier for diffs
            itemLines.push(
              `+${item.element?.value || 1} ${itemName}${moteTag(
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
            )}: ${dropperName}${moteTag(dropper)}`;
            for (const item of bsArrayToArray(dropGroup.element?.items!)) {
              const itemName = packed.getMoteName(item.element?.item_id!);
              // Note: Can probably skip the array tag since we can use the item moteId as the unique identifier for diffs
              dropText += `\n+${
                item.element?.quantity || 1
              } ${itemName}${moteTag(item.element?.item_id!)}`;
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

    if (momentType === 'start') {
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
