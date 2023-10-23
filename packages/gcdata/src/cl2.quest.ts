import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import { bsArrayToArray, isObjectSchema } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import { Range } from './types.editor.js';
import type { Bschema, Mote } from './types.js';
import { capitalize, match, re, resolvePointerInSchema } from './util.js';

// PATTERNS
// Note: These patterns are defined so that they'll work on partial lines
// as much as possible, so their group names should always be checked for existence.
const arrayTagPattern = '(?:#(?<arrayTag>[a-z0-9]+))';
const moteTagPattern = '(?:@(?<moteTag>[a-z0-9_]+))';
const moteNamePattern = "(?<moteName>[A-Za-z0-9 '-]+)";
const emojiGroupPattern = '(?<emojiGroup>\\(\\s*(?<emojiName>[^)]+?)\\)\\s*)';
const labeledLinePattern = `^(?<label>[\\w -]+)${arrayTagPattern}?\\s*:\\s*(?<rest>.*)?$`;
const dialogSpeakerPattern = `^\\t(${moteNamePattern}${moteTagPattern}?)?`;
const dialogTextPattern = `^>\\s*?${arrayTagPattern}?(\\s+${emojiGroupPattern}?(?<text>.*))?$`;
const objectivePattern = `^-\\s*?${arrayTagPattern}?(\\s+(?<style>[\\w -]+))?$`;
const emoteDeclarationPattern = `^:\\)\\s*${arrayTagPattern}?`;
const emotePattern = `^!\\s*?${arrayTagPattern}?(\\s+${moteNamePattern}${moteTagPattern}\\s+${emojiGroupPattern})?`;
const addItemPattern = `^\\+((?<count>\\d+)\\s+${moteNamePattern}${moteTagPattern})?`;
const requirementPattern = `^\\?\\s*?${arrayTagPattern}?((\\s+(?<style>[\\w -]+))(:\\s*(?<rest>.*))?)?$`;

export interface QuestUpdateResult {
  diagnostics: (Range & { message: string })[];
  hovers: (Range & { title?: string; description?: string })[];
}

export function questTextToMote(
  text: string,
  mote: Mote<Crashlands2.Quest>,
  packed: Packed,
): QuestUpdateResult {
  const result: QuestUpdateResult = {
    diagnostics: [],
    hovers: [],
  };

  const lines = text.split(/(\r?\n)/g);
  let index = 0;
  let lineNumber = 0;
  const schemaStack: Bschema[] = [packed.getSchema(mote.schema_id)];

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
      // TODO: Add available autocompletes
      continue;
    }

    // Is it a "Label:" line?
    if (re(labeledLinePattern).test(line)) {
      let { label, arrayTag, rest } = match(line, labeledLinePattern).groups;
      const labelRange: Range = {
        start: { index, line: lineNumber, character: 0 },
        end: {
          index: index + label!.length,
          line: lineNumber,
          character: label!.length,
        },
      };
      let dataPointer:
        | [keyof Crashlands2.Quest, ...(string | undefined)[]]
        | undefined;
      switch (label?.toLowerCase()) {
        case 'name':
          dataPointer = ['name'];
          break;
        case 'storyline':
          dataPointer = ['storyline'];
          break;
        case 'draft':
          dataPointer = ['wip', 'draft'];
          break;
        case 'note':
          dataPointer = ['wip', 'comments', arrayTag];
          break;
        case 'giver':
          dataPointer = ['quest_giver', 'item'];
          break;
        case 'receiver':
          dataPointer = ['quest_receiver', 'item'];
          break;
        case 'log':
          dataPointer = ['quest_start_log', 'text'];
          break;
        case 'objectives':
          dataPointer = ['objectives'];
          break;
        case 'clue':
          dataPointer = ['clues', arrayTag];
          break;
        case 'start requirements':
          dataPointer = ['quest_start_requirements'];
          break;
        case 'start moments':
          dataPointer = ['quest_start_moments'];
          break;
        case 'end requirements':
          dataPointer = ['quest_end_requirements'];
          break;
        case 'end moments':
          dataPointer = ['quest_end_moments'];
          break;
      }
      // TODO: If no match, then the label should be an enum option from a "style" field of the data structure we're inside of
      if (dataPointer) {
        const subschema = resolvePointerInSchema(
          dataPointer as string[],
          mote,
          packed,
        );
        // Update the schemastack if this is an object schema
        if (isObjectSchema(subschema)) {
          schemaStack.push(subschema);
        }
        // Add hovertext for the label
        if (subschema.description || subschema.title) {
          result.hovers.push({
            ...labelRange,
            title: subschema.title,
            description: subschema.description,
          });
        }
      } else {
        console.error(`Unknown label: ${label}`, schemaStack.at(-1));
      }
    } else if (re(dialogSpeakerPattern).test(line)) {
      const { moteName, moteTag } = match(line, dialogSpeakerPattern).groups;
    } else if (re(dialogTextPattern).test(line)) {
      const { arrayTag, emojiName, text } = match(
        line,
        dialogTextPattern,
      ).groups;
    } else if (re(objectivePattern).test(line)) {
      const { arrayTag, style } = match(line, objectivePattern).groups;
    } else if (re(emoteDeclarationPattern).test(line)) {
      const { arrayTag } = match(line, emoteDeclarationPattern).groups;
    } else if (re(emotePattern).test(line)) {
      const { arrayTag, moteName, moteTag, emojiName } = match(
        line,
        emotePattern,
      ).groups;
    } else if (re(addItemPattern).test(line)) {
      const { count, moteName, moteTag } = match(line, addItemPattern).groups;
    } else if (re(requirementPattern).test(line)) {
      const { arrayTag, style, rest } = match(line, requirementPattern).groups;
    } else {
      result.diagnostics.push({
        message: `Unfamiliar syntax: ${line}`,
        start: { index, line: lineNumber, character: 0 },
        end: {
          index: index + line.length,
          line: lineNumber,
          character: line.length,
        },
      });
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
