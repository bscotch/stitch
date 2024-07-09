import {
  arrayTagPattern,
  getEmojis,
  getStagingOptions,
  lineIsArrayItem,
  ParsedLine,
  parseIfMatch,
  ParserResult,
} from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { createBsArrayKey } from './helpers.js';
import { ParsedLineItem } from './types.editor.js';
import { checkWords } from './util.js';

export function prepareParserHelpers(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
    globalLabels?: Set<string>;
    globalNonUniqueLabels?: Set<string>;
  } = {},
  result: ParserResult<any>,
) {
  /** Terms from the glossary for use in autocompletes */
  const glossaryTerms = (packed.glossary?.relevantTerms() || []).map(
    (t) => t.text,
  );

  const checkSpelling = (item: ParsedLineItem<any> | undefined) => {
    if (!item || !options.checkSpelling || !packed.glossary) return;
    result.words.push(...checkWords(item, packed.glossary));
  };

  const lines = text.split(/(\r?\n)/g);

  let index = 0;
  let lineNumber = 0;
  let currentLine = lines[0];

  const currentLineRange = () => {
    return {
      start: {
        index,
        line: lineNumber,
        character: 0,
      },
      end: {
        index: index + currentLine.length,
        line: lineNumber,
        character: currentLine.length,
      },
    };
  };

  const parseCurrentLine = (linePatterns: string[]): ParsedLine | null => {
    // Find the first matching pattern and pull the values from it.
    let parsedLine: null | ParsedLine = null;
    const lineRange = currentLineRange();
    for (const pattern of linePatterns) {
      parsedLine = parseIfMatch(pattern, currentLine, lineRange.start);
      if (parsedLine) break;
    }
    if (!parsedLine) {
      // Then this is likely the result of uncommenting something
      // that was commented out, resulting in a line that starts with
      // the comment's array tag. Provide a deletion edit!
      parsedLine = parseIfMatch(
        `^${arrayTagPattern} +(?<text>.*)$`,
        currentLine,
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
          message: `Unfamiliar syntax: ${currentLine}`,
          ...lineRange,
        });
      }
      index += currentLine.length;
      return null;
    }

    // Ensure the array tag. It goes right after the label or indicator.
    if (!parsedLine.arrayTag?.value && lineIsArrayItem(currentLine)) {
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
      options.globalLabels?.has(parsedLine.label.value) &&
      !options.globalNonUniqueLabels?.has(parsedLine.label.value)
    ) {
      options.globalLabels.delete(parsedLine.label.value);
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

    return parsedLine;
  };

  const stagingOptions = getStagingOptions(packed.working);
  const emojis = getEmojis(packed.working);
  const emojiIdFromName = (name: string | undefined): string | undefined => {
    if (!name) {
      return undefined;
    }
    const emoji = emojis.find(
      (e) =>
        packed.working.getMoteName(e)?.toLowerCase() ===
          name?.trim().toLowerCase() || e.id === name?.trim(),
    );
    return emoji?.id;
  };

  return {
    glossaryTerms,
    stagingOptions,
    emojis,
    emojiIdFromName,
    checkSpelling,
    parseCurrentLine,
    get currentLineRange() {
      return currentLineRange();
    },
    lines: {
      // Use a generator
      *[Symbol.iterator]() {
        for (const line of lines) {
          if (line.match(/\r?\n/)) {
            index += line.length;
            lineNumber++;
            continue;
          }
          // If this is an empty line, add global autocompletes
          if (!line && options.globalLabels) {
            const lineRange = currentLineRange();
            // Add global autocompletes
            result.completions.push({
              type: 'labels',
              start: lineRange.start,
              end: lineRange.end,
              options: options.globalLabels,
            });
          }

          currentLine = line;
          yield line;
        }
      },
    },
    index,
    lineNumber,
  };
}
