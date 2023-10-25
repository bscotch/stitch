import type { Packed } from './Packed.js';
import { assert } from './assert.js';
import {
  Label,
  ParsedLine,
  QuestUpdateResult,
  getPointerForLabel,
  lineIsArrayItem,
  linePatterns,
  parseIfMatch,
} from './cl2.quest.types.js';
import { getAllowedGivers, getAllowedSpeakers } from './cl2.quest.utils.js';
import { createBsArrayKey } from './helpers.js';
import type { Crashlands2 } from './types.cl2.js';
import { Position, Range } from './types.editor.js';
import type { Bschema, Mote } from './types.js';
import { resolvePointerInSchema } from './util.js';
export { questMoteToText } from './cl2.quest.stringify.js';
export type { QuestUpdateResult } from './cl2.quest.types.js';

export function questTextToMote(
  text: string,
  mote: Mote<Crashlands2.Quest>,
  packed: Packed,
): QuestUpdateResult {
  const allowedSpeakers = getAllowedSpeakers(packed);
  assert(
    allowedSpeakers.length > 0,
    'Should have at least one allowed speaker mote',
  );
  const allowedGivers = getAllowedGivers(packed);
  assert(
    allowedGivers.length > 0,
    'Should have at least one allowed giver mote',
  );
  const storylines =
    packed.listMotesBySchema<Crashlands2.Schemas['cl2_storyline']>(
      'cl2_storyline',
    );
  assert(storylines.length > 0, 'Should have at least one storyline mote');

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
  let section: Label | undefined;

  for (const line of lines) {
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

    // Figure out what data/subschema is represented by this line
    const labelLower = parsedLine.label?.value?.toLowerCase();
    if (parsedLine.indicator?.value === '\t') {
      requiresMote = {
        at: parsedLine.indicator.end,
        options: allowedSpeakers,
      };
    } else if (labelLower) {
      const pointer = getPointerForLabel(
        labelLower,
        parsedLine.arrayTag?.value,
      );
      let subschema: Bschema | undefined;
      if (pointer) {
        // Then we're in a new "section"
        section = labelLower as Label;
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
      if (['giver', 'receiver'].includes(labelLower)) {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: allowedGivers,
        };
      } else if (labelLower === 'storyline') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: storylines,
        };
      } else if (labelLower === 'clue') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: allowedSpeakers,
        };
      }
    } else {
      // Then this is an "indicator" line. Indicators are prefixes that identify the kind of thing we're dealing with. Some of them are unambiguous, others require knowing what section we're in.
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

    index += line.length;
  }

  return result;
}
