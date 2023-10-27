import { Packed } from './Packed.js';
import {
  ParsedClue,
  ParsedDialog,
  ParsedEmojiGroup,
  ParsedLine,
  QuestUpdateResult,
  arrayTagPattern,
  lineIsArrayItem,
  linePatterns,
  parseIfMatch,
} from './cl2.quest.types.js';
import { getMoteLists } from './cl2.quest.utils.js';
import { changedPosition, createBsArrayKey } from './helpers.js';
import { Crashlands2 } from './types.cl2.js';
import { Position } from './types.editor.js';
import { Mote } from './types.js';

export function parseStringifiedMote(
  text: string,
  mote: Mote<Crashlands2.Quest>,
  packed: Packed,
): QuestUpdateResult {
  const motes = getMoteLists(packed);

  /**
   * Shared list of keywords that can be used at the start of any line,
   * with required-unique entries removed when found.
   */
  const nonUniqueGlobalLabels = new Set<string>(['Clue']);
  const availableGlobalLabels = new Set<string>([
    'Draft',
    'Name',
    'Storyline',
    'Giver',
    'Receiver',
    'Clue',
    'Start Moments',
    'End Moments',
    'Log',
  ]);

  const result: QuestUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
    parsed: {
      clues: [],
      quest_end_moments: [],
      quest_start_moments: [],
      comments: [],
    },
  };

  const lines = text.split(/(\r?\n)/g);

  let index = 0;
  let lineNumber = 0;

  const emojiIdFromName = (name: string | undefined): string | undefined => {
    if (!name) {
      return undefined;
    }
    const emoji = motes.emojis.find(
      (e) =>
        packed.getMoteName(e).toLowerCase() === name?.trim().toLowerCase() ||
        e.id === name?.trim(),
    );
    return emoji?.id;
  };

  /** The MoteId for the last speaker we saw. Used to figure out who to assign stuff to */
  let lastSpeaker: undefined | string;
  let lastClue: undefined | ParsedClue;
  let lastMomentGroup: 'quest_start_moments' | 'quest_end_moments' | undefined;
  let lastEmojiGroup: undefined | ParsedEmojiGroup;

  for (const line of lines) {
    const trace: any[] = [];

    try {
      // Is this just a newline?
      if (line.match(/\r?\n/)) {
        // Then we just need to increment the index
        index += line.length;
        lineNumber++;
        continue;
      }

      const lineRange = {
        start: {
          index,
          line: lineNumber,
          character: 0,
        },
        end: {
          index: index + line.length,
          line: lineNumber,
          character: line.length,
        },
      };

      // Is this just a blank line?
      if (!line) {
        // Add global autocompletes
        result.completions.push({
          type: 'labels',
          start: lineRange.start,
          end: lineRange.end,
          options: availableGlobalLabels,
        });
        continue;
      }

      // Find the first matching pattern and pull the values from it.
      let parsedLine: null | ParsedLine = null;
      for (const pattern of linePatterns) {
        parsedLine = parseIfMatch(pattern, line, lineRange.start);
        if (parsedLine) break;
      }
      if (!parsedLine) {
        // Then this is likely the result of uncommenting something
        // that was commented out, resulting in a line that starts with
        // the comment's array tag. Provide a deletion edit!
        parsedLine = parseIfMatch(
          `^${arrayTagPattern} +(?<text>.*)$`,
          line,
          lineRange.start,
        );
        if (parsedLine) {
          result.edits.push({
            start: lineRange.start,
            end: lineRange.end,
            newText: parsedLine.text!.value!,
          });
        } else {
          result.diagnostics.push({
            message: `Unfamiliar syntax: ${line}`,
            ...lineRange,
          });
        }

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

      // Track common problems so that we don't need to repeat logic
      /** The character where a mote should exist. */
      let requiresMote: undefined | { at: Position; options: Mote[] };
      let requiresEmoji: undefined | { at: Position; options: Mote[] };

      // Work through each line type to add diagnostics and completions
      const labelLower = parsedLine.label?.value?.toLowerCase();
      const indicator = parsedLine.indicator?.value;

      // Resets
      if (indicator !== '>') {
        // Then we need to reset the speaker
        lastSpeaker = undefined;
        lastClue = undefined;
      }
      if (indicator !== '!') {
        lastEmojiGroup = undefined;
      }

      // Parsing
      if (labelLower === 'start moments') {
        lastMomentGroup = 'quest_start_moments';
      } else if (labelLower === 'end moments') {
        lastMomentGroup = 'quest_end_moments';
      }
      if (indicator === '\t') {
        // No data gets stored here, this is just a convenience marker
        // to set the speaker for the next set of dialog lines.
        requiresMote = {
          at: parsedLine.indicator!.end,
          options: motes.allowedSpeakers,
        };
        lastSpeaker = parsedLine.moteTag?.value;
      } else if (labelLower === 'clue') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedSpeakers,
        };
        lastClue = {
          id: parsedLine.arrayTag?.value?.trim(),
          speaker: parsedLine.moteTag?.value?.trim(),
          phrases: [],
        };
        result.parsed.clues ||= [];
        result.parsed.clues.push(lastClue);
      } else if (indicator === '>') {
        // Then this is a dialog line, either within a Clue or a Dialog Moment
        const emoji = emojiIdFromName(parsedLine.emojiName?.value);
        if (parsedLine.emojiGroup) {
          // Emojis are optional. If we see a "group" (parentheses) then
          // that changes to a requirement.
          requiresEmoji = {
            at: changedPosition(parsedLine.emojiGroup.start, { characters: 1 }),
            options: motes.emojis,
          };
        }
        const moment: ParsedDialog = {
          id: parsedLine.arrayTag?.value?.trim(),
          speaker: lastSpeaker,
          emoji,
          text: parsedLine.text?.value?.trim() || '',
        };
        if (lastClue) {
          lastClue.phrases.push(moment);
        } else if (lastMomentGroup) {
          result.parsed[lastMomentGroup].push(moment);
        } else {
          // Then this is an error!
          result.diagnostics.push({
            message: `Dialog line without a Clue or Moment!`,
            ...lineRange,
          });
        }
      } else if (labelLower === 'name') {
        result.parsed.name = parsedLine.moteName?.value?.trim();
      } else if (labelLower === 'draft') {
        result.parsed.draft = parsedLine.moteName?.value?.trim() === 'true';
      } else if (labelLower === 'log') {
        result.parsed.quest_start_log = parsedLine.moteTag?.value?.trim();
      } else if (labelLower === 'storyline') {
        // TODO: Storyline stuff
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.storylines,
        };
      } else if (labelLower === 'giver') {
        // TODO: Giver stuff
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedGivers,
        };
      } else if (labelLower === 'receiver') {
        // TODO: Receiver stuff
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedGivers,
        };
      } else if (indicator === ':)') {
        // TODO: Then this is a declaration line for an Emote moment
        // TODO: If it has a new ID, add it to the mote!
      } else if (indicator === '!') {
        // TODO: Then this is an emote within a Emote moment
      } else if (indicator === '?') {
        // TODO: Then this is a non-dialog quest moment
      } else if (indicator === '//') {
        // TODO: Handle notes
      }

      if (requiresEmoji) {
        const where = {
          start: requiresEmoji.at,
          end: parsedLine.emojiGroup!.end,
        };
        if (!parsedLine.emojiName?.value) {
          result.completions.push({
            type: 'motes',
            options: requiresEmoji.options,
            ...where,
          });
        } else if (!emojiIdFromName(parsedLine.emojiName?.value)) {
          result.diagnostics.push({
            message: `Emoji "${parsedLine.emojiName?.value}" not found!`,
            ...where,
          });
        }
      }
      if (requiresMote) {
        if (!parsedLine.moteName || !parsedLine.moteTag) {
          const where = {
            start: requiresMote.at,
            end: parsedLine.emojiGroup?.start || lineRange.end,
          };
          result.completions.push({
            type: 'motes',
            options: requiresMote.options,
            ...where,
          });
          if (!parsedLine.moteTag) {
            result.diagnostics.push({
              message: `Mote required!`,
              ...where,
            });
          } else if (!packed.getMote(parsedLine.moteTag.value!)) {
            result.diagnostics.push({
              message: `Mote not found!`,
              ...where,
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        err.cause = trace;
      }
      throw err;
    }

    index += line.length;
  }

  return result;
}
