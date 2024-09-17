import type { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import {
  isCommentLine,
  isStageLine,
  prepareParserHelpers,
  updateWipChangesFromParsed,
} from './cl2.shared.parse.js';
import { storylineSchemaId } from './cl2.shared.types.js';
import { StorylineMoteDataPointer } from './cl2.storyline.pointers.js';
import {
  getStorylineSchema,
  linePatterns,
  type StorylineUpdateResult,
} from './cl2.storyline.types.js';

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

  const helpers = prepareParserHelpers(
    text,
    packed,
    {
      ...options,
      schemaId: storylineSchemaId,
      globalLabels: new Set<string>(['Name', 'Description', 'Stage']),
    },
    result,
  );

  for (const line of helpers.lines) {
    const trace: any[] = [];
    try {
      if (!line) {
        continue;
      }
      const lineRange = helpers.currentLineRange;

      // Find the first matching pattern and pull the values from it.
      const parsedLine = helpers.parseCurrentLine(linePatterns);
      if (!parsedLine) continue;

      // Work through each line type to add diagnostics and completions
      const labelLower = parsedLine.label?.value?.toLowerCase();
      if (isCommentLine(parsedLine)) {
        helpers.addComment(parsedLine);
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
        helpers.checkSpelling(parsedLine.text);
      } else if (isStageLine(parsedLine)) {
        helpers.addStage(parsedLine);
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
    helpers.index += line.length;
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

    updateWipChangesFromParsed(parsed, moteId, packed, trace);

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
