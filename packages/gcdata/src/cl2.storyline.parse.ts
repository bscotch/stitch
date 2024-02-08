import type { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import type { ParsedLine, ParsedLineItem } from './cl2.quest.types.js';
import { StorylineMoteDataPointer } from './cl2.storyline.pointers.js';
import {
  arrayTagPattern,
  getStorylineMote,
  getStorylineSchema,
  lineIsArrayItem,
  linePatterns,
  parseIfMatch,
  storylineSchemaId,
  type StorylineUpdateResult,
} from './cl2.storyline.types.js';
import {
  bsArrayToArray,
  createBsArrayKey,
  updateBsArrayOrder,
} from './helpers.js';
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
    parsed: {
      comments: [],
    },
  };

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

      // Work through each line type to add diagnostics and completions
      const labelLower = parsedLine.label?.value?.toLowerCase();
      const indicator = parsedLine.indicator?.value;
      if (indicator === '//') {
        // Then this is a comment/note
        result.parsed.comments.push({
          id: parsedLine.arrayTag?.value?.trim(),
          text: parsedLine.text?.value?.trim(),
        });
        checkSpelling(parsedLine.text);
      } else if (labelLower === 'name') {
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
      } else if (labelLower === 'draft') {
        result.parsed.draft = parsedLine.text?.value?.trim() === 'true';
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
    const storylineMoteBase = getStorylineMote(packed.base, moteId);
    const storylineMoteWorking = getStorylineMote(packed.working, moteId);
    const schema = getStorylineSchema(packed.working);
    assert(schema, `${storylineSchemaId} schema not found in working copy`);
    assert(schema.name, 'Quest mote must have a name pointer');
    const updateMote = (path: StorylineMoteDataPointer, value: any) => {
      packed.updateMoteData(moteId, path, value);
    };
    updateMote('data/name/text', parsed.name);
    updateMote('data/description/text', parsed.description);
    updateMote('data/wip/draft', parsed.draft);

    const parsedComments = parsed.comments.filter((c) => !!c.text);

    //#region COMMENTS
    // Add/Update COMMENTS
    trace(`Updating comments`);
    for (const comment of parsedComments) {
      trace(`Updating comment ${comment.id} with text "${comment.text}"`);
      updateMote(`data/wip/comments/${comment.id}/element`, comment.text);
    }
    // Remove deleted comments
    for (const existingComment of bsArrayToArray(
      storylineMoteBase?.data.wip?.comments || {},
    )) {
      if (!parsedComments.find((c) => c.id === existingComment.id)) {
        trace(`Deleting comment ${existingComment.id}`);
        updateMote(`data/wip/comments/${existingComment.id}`, null);
      }
    }
    // Get the BASE order of the comments (if any) and use those
    // as the starting point for an up to date order.
    const comments = parsedComments.map((c) => {
      // Look up the base comment
      let comment = storylineMoteBase?.data.wip?.comments?.[c.id!];
      if (!comment) {
        comment = storylineMoteWorking?.data.wip?.comments?.[c.id!];
        // @ts-expect-error - order is a required field, but it'll be re-added
        delete comment?.order;
      }
      assert(comment, `Comment ${c.id} not found in base or working mote`);
      return { ...comment, id: c.id! };
    });
    trace('Updating comment order');
    updateBsArrayOrder(comments);
    comments.forEach((comment) => {
      trace(`Updating comment ${comment.id} order to ${comment.order}`);
      updateMote(`data/wip/comments/${comment.id}/order`, comment.order);
    });
    //#endregion

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
