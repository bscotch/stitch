import { Packed } from './Packed.js';
import {
  ParsedClue,
  ParsedDialog,
  ParsedEmoteGroup,
  ParsedLine,
  QuestUpdateResult,
  arrayTagPattern,
  lineIsArrayItem,
  linePatterns,
  parseIfMatch,
} from './cl2.quest.types.js';
import { getMomentStyleNames, getMoteLists } from './cl2.quest.utils.js';
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
  const momentStyles = getMomentStyleNames(packed);
  // Remove 'Dialogue' and 'Emote' from the list of moment styles
  for (const style of ['Dialogue', 'Emote']) {
    momentStyles.splice(momentStyles.indexOf(style), 1);
  }

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
  let lastEmojiGroup: undefined | ParsedEmoteGroup;

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
        if (lastMomentGroup) {
          result.completions.push({
            type: 'momentStyles',
            options: momentStyles,
            start: lineRange.start,
            end: lineRange.end,
          });
        }
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
        result.parsed.name = parsedLine.text?.value?.trim();
        if (!result.parsed.name) {
          result.diagnostics.push({
            message: `Quest name required!`,
            ...lineRange,
          });
        }
      } else if (labelLower === 'draft') {
        result.parsed.draft = parsedLine.text?.value?.trim() === 'true';
      } else if (labelLower === 'log') {
        result.parsed.quest_start_log = parsedLine.text?.value?.trim();
      } else if (labelLower === 'storyline') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.storylines,
        };
        result.parsed.storyline = parsedLine.moteTag?.value?.trim();
      } else if (labelLower === 'giver') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedGivers,
        };
        result.parsed.quest_giver = parsedLine.moteTag?.value?.trim();
      } else if (labelLower === 'receiver') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedGivers,
        };
        result.parsed.quest_receiver = parsedLine.moteTag?.value?.trim();
      } else if (indicator === ':)') {
        if (lastMomentGroup) {
          // Then this is a declaration line for an Emote moment
          // Create the new emoji group
          lastEmojiGroup = {
            id: parsedLine.arrayTag?.value?.trim(),
            emotes: [],
          };
          result.parsed[lastMomentGroup].push(lastEmojiGroup);
        } else {
          result.diagnostics.push({
            message: `Must be defined in a Start/End Moments section!`,
            ...lineRange,
          });
        }
      } else if (indicator === '!') {
        // Then this is an emote within a Emote moment

        if (lastEmojiGroup) {
          // Add speaker autocompletes
          if (parsedLine.sep) {
            requiresMote = {
              at: parsedLine.sep!.end,
              options: motes.allowedSpeakers,
            };
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Space required after the prefix.`,
              ...lineRange,
            });
          }
          // Add emoji autocompletes
          if (parsedLine.emojiGroup) {
            requiresEmoji = {
              at: changedPosition(parsedLine.emojiGroup.start, {
                characters: 1,
              }),
              options: motes.emojis,
            };
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Emoji required after the speaker.`,
              ...lineRange,
            });
          }
          lastEmojiGroup.emotes.push({
            id: parsedLine.arrayTag?.value?.trim(),
            speaker: parsedLine.moteTag?.value?.trim(),
            emoji: emojiIdFromName(parsedLine.emojiName?.value),
          });
        } else {
          result.diagnostics.push({
            message: `Missing an Emote declaration line!`,
            ...lineRange,
          });
        }
      } else if (indicator === '?') {
        // Then this is a non-dialog quest moment. These are not implemented, but should be available as placeholders.
        if (lastMomentGroup) {
          // Put an autocomplete after the "?#meh " prefix
          if (parsedLine.sep) {
            result.completions.push({
              type: 'momentStyles',
              options: momentStyles,
              start: parsedLine.sep!.end,
              end: parsedLine.sep!.end,
            });
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Space required after the prefix.`,
              ...lineRange,
            });
          }

          // Add to data if this momentStyle actually exists
          if (momentStyles.includes(parsedLine.style?.value as any)) {
            result.parsed[lastMomentGroup].push({
              id: parsedLine.arrayTag?.value?.trim(),
              style: parsedLine.style?.value as any,
            });
          } else {
            result.diagnostics.push({
              message: `Unknown moment style "${parsedLine.style?.value}"`,
              ...lineRange,
            });
          }
        } else {
          result.diagnostics.push({
            message: `Must be defined in a Start/End Moments section!`,
            ...lineRange,
          });
        }
      } else if (indicator === '//') {
        // Then this is a comment/note
        result.parsed.comments.push({
          id: parsedLine.arrayTag?.value?.trim(),
          text: parsedLine.text?.value?.trim(),
        });
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
