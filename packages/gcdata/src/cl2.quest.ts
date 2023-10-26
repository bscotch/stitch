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
  sections,
} from './cl2.quest.types.js';
import { getMomentStyleSchema, getMoteLists } from './cl2.quest.utils.js';
import { createBsArrayKey } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import { Position, Range } from './types.editor.js';
import type { Bschema, Mote } from './types.js';
import { resolvePointerInSchema } from './util.js';
export { stringifyMote } from './cl2.quest.stringify.js';
export type { QuestUpdateResult } from './cl2.quest.types.js';

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

  /**
   * The lowercased name of the last section we transitioned to.
   * (A "section" is created by certain top-level labels, like "Start Moments",
   * that can contain multiple entries)
   */
  const sectionLabels = new Set(sections);
  let section: Section | undefined;

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

      // Find the first matching pattern and pull the values
      // from it.
      let parsedLine: null | ParsedLine = null;
      for (const pattern of linePatterns) {
        parsedLine = parseIfMatch(pattern, line, lineRange.start);
        if (parsedLine) break;
      }
      if (!parsedLine) {
        result.diagnostics.push({
          message: `Unfamiliar syntax: ${line}`,
          ...lineRange,
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

      // Track common problems so that we don't need to repeat logic
      /** The character where a mote should exist. */
      let requiresMote: undefined | { at: Position; options: Mote[] };
      let requiresEmoji: undefined | { at: Position; options: string[] };

      // Figure out what data/subschema is represented by this line
      const labelLower = parsedLine.label?.value?.toLowerCase();
      if (parsedLine.indicator?.value === '\t') {
        requiresMote = {
          at: parsedLine.indicator.end,
          options: motes.allowedSpeakers,
        };
      } else if (labelLower) {
        // Are we starting a new section?
        if (sectionLabels.has(labelLower as Section)) {
          section = labelLower as Section;
        }
        const pointer = getPointerForLabel(
          labelLower,
          parsedLine.arrayTag?.value,
          section,
        );
        let subschema: Bschema | undefined;
        trace.push({ pointer, parsedLine, section, moteId: mote.id });
        if (pointer) {
          subschema = resolvePointerInSchema(pointer, mote, packed);
          assert(subschema, `No subschema found for pointer ${pointer}`);
          addHover(parsedLine.label!, subschema);
        } else if (section?.endsWith('moments')) {
          // Then this is a moment style that is not yet implemented.
          // It'll be in the form Label#arrayTag: Not Editable
          subschema = getMomentStyleSchema(parsedLine.label!.value!, packed);
        } else {
          throw new Error(`No pointer found for label ${labelLower}`);
        }
        assert(subschema, `No subschema found for pointer ${pointer}`);
        addHover(parsedLine.label!, subschema);
        if (['giver', 'receiver'].includes(labelLower)) {
          requiresMote = {
            at: parsedLine.labelGroup!.end,
            options: motes.allowedGivers,
          };
        } else if (labelLower === 'storyline') {
          requiresMote = {
            at: parsedLine.labelGroup!.end,
            options: motes.storylines,
          };
        } else if (labelLower === 'clue') {
          requiresMote = {
            at: parsedLine.labelGroup!.end,
            options: motes.allowedSpeakers,
          };
        } else if (labelLower === 'drop item') {
          requiresMote = {
            at: parsedLine.labelGroup!.end,
            options: motes.droppers,
          };
        }
      } else {
        // Then this is an "indicator" line. Indicators are prefixes that identify the kind of thing we're dealing with. Some of them are unambiguous, others require knowing what section we're in.
        const indicator = parsedLine.indicator?.value!;
        if (indicator === ':)') {
          // Then this is a declaration line for an Emote moment
        } else if (indicator === '!') {
          // Then this is an emote within a dialogue moment
        } else if (indicator === '>') {
          // Then this is a dialog line, either within a Clue or a Dialog Moment
        } else if (indicator === '+') {
          // Then this is an item drop
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
