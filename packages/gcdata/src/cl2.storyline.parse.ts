import type { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import type { ParsedLine, ParsedLineItem } from './cl2.quest.types.js';
import { StorylineMoteDataPointer } from './cl2.storyline.pointers.js';
import {
  arrayTagPattern,
  getStorylineSchema,
  lineIsArrayItem,
  linePatterns,
  parseIfMatch,
  storylineSchemaId,
  type StorylineUpdateResult,
} from './cl2.storyline.types.js';
import { createBsArrayKey } from './helpers.js';
import { checkWords } from './util.js';

export function parseStringifiedStoryline(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
): StorylineUpdateResult {
  const result: StorylineUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
    words: [],
    parsed: {},
  };

  /** Terms from the glossary for use in autocompletes */
  const glossaryTerms = (packed.glossary?.relevantTerms() || []).map(
    (t) => t.text,
  );

  const checkSpelling = (item: ParsedLineItem<any> | undefined) => {
    if (!item || !options.checkSpelling) return;
    result.words.push(...checkWords(item, packed.glossary));
  };

  const lines = text.split(/(\r?\n)/g);

  let index = 0;
  let lineNumber = 0;

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
      // Is this just a blank line?
      if (!line) {
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

      // If this has a text section, provide glossary autocompletes
      if ('text' in parsedLine) {
        const start = parsedLine.text!.start;
        const end = parsedLine.text!.end;
        result.completions.push({
          type: 'glossary',
          start,
          end,
          options: glossaryTerms,
        });
      }

      // Work through each line type to add diagnostics and completions
      const labelLower = parsedLine.label?.value?.toLowerCase();
      if (labelLower === 'name') {
        result.parsed.name = parsedLine.text?.value?.trim();
        if (!result.parsed.name) {
          result.diagnostics.push({
            message: `Quest name required!`,
            ...lineRange,
          });
        }
      } else if (labelLower === 'description') {
        result.parsed.description = parsedLine.text?.value?.trim();
        checkSpelling(parsedLine.text);
      } else {
        // Then we're in an error state on this line!
        result.diagnostics.push({
          message: `Unfamiliar syntax: ${line}`,
          ...lineRange,
        });
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

export async function updateChangesFromParsedStoryline(
  parsed: StorylineUpdateResult['parsed'],
  moteId: string,
  packed: GameChanger,
): Promise<void> {
  const _traceLogs: any[] = [];
  const trace = (log: any) => _traceLogs.push(log);
  trace(`Updating mote ${moteId}`);
  try {
    // We're always going to be computing ALL changes, so clear whatever
    // we previously had.
    packed.clearMoteChanges(moteId);
    const schema = getStorylineSchema(packed.working);
    assert(schema, `${storylineSchemaId} schema not found in working copy`);
    assert(schema.name, 'Quest mote must have a name pointer');
    const updateMote = (path: StorylineMoteDataPointer, value: any) => {
      packed.updateMoteData(moteId, path, value);
    };
    updateMote('data/name/text', parsed.name);
    updateMote('data/description/text', parsed.description);

    trace(`Writing changes`);
    await packed.writeChanges();
  } catch (err) {
    console.error(err);
    console.error(_traceLogs);
    if (err instanceof Error) {
      err.cause = _traceLogs;
    }
    throw err;
  }
}
