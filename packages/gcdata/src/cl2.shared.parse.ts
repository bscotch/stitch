import { assert } from './assert.js';
import {
  arrayTagPattern,
  getEmojis,
  getStagingOptions,
  lineIsArrayItem,
  ParsedBase,
  ParsedLine,
  parseIfMatch,
  ParserResult,
} from './cl2.shared.types.js';
import { StorylineMoteDataPointer } from './cl2.storyline.pointers.js';
import type { GameChanger } from './GameChanger.js';
import {
  bsArrayToArray,
  createBsArrayKey,
  updateBsArrayOrder,
} from './helpers.js';
import { ParsedLineItem } from './types.editor.js';
import { checkWords, includes } from './util.js';

export function prepareParserHelpers(
  text: string,
  packed: GameChanger,
  options: {
    schemaId: string;
    checkSpelling?: boolean;
    globalLabels?: Set<string>;
    globalNonUniqueLabels?: Set<string>;
  },
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

    parsedLine._hadArrayTag =
      !!parsedLine.arrayTag?.value ||
      // Might have one even if it wasn't in the pattern.'
      // This safety prevent loops and other surprises
      !!currentLine.match(new RegExp(arrayTagPattern));

    // Ensure the array tag. It goes right after the label or indicator.
    if (
      lineIsArrayItem(currentLine, options.schemaId) &&
      !parsedLine._hadArrayTag
    ) {
      const arrayTag = createBsArrayKey();
      const start =
        parsedLine.indicator?.end ||
        parsedLine.label?.end! ||
        parsedLine.labelGroup?.end!;
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
    addComment: (line: ParsedLine) => {
      result.parsed.comments.push({
        id: line.arrayTag?.value?.trim(),
        text: line.text?.value?.trim(),
      });
      checkSpelling(line.text);
    },
    addStage: (line: ParsedLine) => {
      const stage = line.text?.value?.trim();
      if (includes(stagingOptions, stage)) {
        result.parsed.stage = stage;
      } else {
        const range = currentLineRange();
        result.diagnostics.push({
          message: `Stage must be one of: ${stagingOptions.join(', ')}`,
          ...range,
        });
        // Provide autocomplete options
        result.completions.push({
          type: 'stages',
          options: stagingOptions,
          start: line.labelGroup!.end,
          end: range.end,
        });
      }
    },
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

export function isCommentLine(line: ParsedLine): boolean {
  return line.indicator?.value === '//';
}

export function isStageLine(line: ParsedLine): boolean {
  return line.label?.value?.toLowerCase() === 'stage';
}

export function updateWipChangesFromParsed(
  parsed: ParsedBase,
  moteId: string,
  packed: GameChanger,
  trace: (msg: any) => void,
) {
  const baseMote = packed.base.getMote(moteId);
  const workingMote = packed.working.getMote(moteId);

  // Could use pretty much any pointer, since all motes have WIP
  const updateMote = (path: StorylineMoteDataPointer, value: any) => {
    packed.updateMoteData(moteId, path, value);
  };

  if (parsed.stage) {
    updateMote('data/wip/staging', parsed.stage);
  } else if (workingMote?.data.wip) {
    updateMote('data/wip/staging', null);
  }

  // Add/Update COMMENTS
  trace(`Updating comments`);
  const parsedComments = parsed.comments.filter((c) => !!c.text);
  for (const comment of parsedComments) {
    trace(`Updating comment ${comment.id} with text "${comment.text}"`);
    updateMote(`data/wip/notes/${comment.id}/element/text`, comment.text);
  }
  // Remove deleted comments
  for (const existingComment of bsArrayToArray(
    baseMote?.data.wip?.notes || {},
  )) {
    if (!parsedComments.find((c) => c.id === existingComment.id)) {
      trace(`Deleting comment ${existingComment.id}`);
      updateMote(`data/wip/notes/${existingComment.id}`, null);
    }
  }
  // Get the BASE order of the comments (if any) and use those
  // as the starting point for an up to date order.
  const comments = parsedComments.map((c) => {
    // Look up the base comment
    let comment = baseMote?.data.wip?.notes?.[c.id!];
    if (!comment) {
      comment = workingMote?.data.wip?.notes?.[c.id!];
      delete comment?.order;
    }
    assert(comment, `Comment ${c.id} not found in base or working mote`);
    return { ...comment, id: c.id! };
  });
  trace('Updating comment order');
  updateBsArrayOrder(comments);
  comments.forEach((comment) => {
    trace(`Updating comment ${comment.id} order to ${comment.order}`);
    updateMote(`data/wip/notes/${comment.id}/order`, comment.order);
  });
}
