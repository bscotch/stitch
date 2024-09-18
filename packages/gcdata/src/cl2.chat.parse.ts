import { assert } from './assert.js';
import { ChatMoteDataPointer } from './cl2.chat.pointers.js';
import {
  linePatterns,
  ParsedMoment,
  ParsedPhrase,
  type ChatUpdateResult,
} from './cl2.chat.types.js';
import {
  isCommentLine,
  isStageLine,
  prepareParserHelpers,
  updateWipChangesFromParsed,
} from './cl2.shared.parse.js';
import {
  ChatMote,
  chatSchemaId,
  listAllCharacters,
} from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { changedPosition, createBsArrayKey } from './helpers.js';
import { Position } from './types.editor.js';
import { Mote } from './types.js';

export function parseStringifiedChat(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
): ChatUpdateResult {
  const result: ChatUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
    words: [],
    parsed: {
      comments: [],
      moments: [],
    },
  };

  const characters = listAllCharacters(packed.working);

  const helpers = prepareParserHelpers(
    text,
    packed,
    {
      ...options,
      schemaId: chatSchemaId,
      globalLabels: new Set(['Stage', 'Name', 'Moments']),
    },
    result,
  );

  let isInMoments = false;
  let currentMoment: ParsedMoment | undefined;
  let currentPhrase: ParsedPhrase | undefined;

  for (const line of helpers.lines) {
    const trace: any[] = [];

    try {
      const lineRange = helpers.currentLineRange;
      // Is this just a blank line?
      if (!line) {
        // If we have a blank line then we're no longer in the same moment
        currentMoment = undefined;
        continue;
      }
      const parsedLine = helpers.parseCurrentLine(linePatterns);
      if (!parsedLine) continue;

      let requiresEmoji: undefined | { at: Position; options: Mote[] };

      // Work through each line type to add diagnostics and completions
      const labelLower = parsedLine.label?.value?.toLowerCase();
      const indicator = parsedLine.indicator?.value;
      if (isCommentLine(parsedLine)) {
        helpers.addComment(parsedLine);
      } else if (labelLower === 'name') {
        result.parsed.name = parsedLine.text?.value?.trim();
        if (!result.parsed.name) {
          result.diagnostics.push({
            message: `Chat name required!`,
            ...lineRange,
          });
        }
      } else if (isStageLine(parsedLine)) {
        helpers.addStage(parsedLine);
      } else if (labelLower === 'moments') {
        if (isInMoments) {
          result.diagnostics.push({
            message: `Moments section already started!`,
            ...lineRange,
          });
        }
        isInMoments = true;
      } else if (indicator === '\t') {
        if (!isInMoments) {
          result.diagnostics.push({
            message: `Not inside the Moments section!`,
            ...lineRange,
          });
        } else {
          // Then we're in a moments header, e.g. "#rt10#kqbq RONXX@brubus_northwatch3"
          // Need to auto-insert array tags if missing
          let momentId: string =
            parsedLine.arrayTag?.value ||
            currentMoment?.id ||
            createBsArrayKey();

          if (!currentMoment || currentMoment.id !== momentId) {
            currentMoment = {
              id: momentId,
              phrases: [],
            };
            result.parsed.moments.push(currentMoment);
          }
          let phraseId = parsedLine.arrayTag2?.value || createBsArrayKey();
          currentPhrase = {
            id: phraseId,
            speaker: parsedLine.moteTag?.value,
            // text and emoji are added later!
          };
          currentMoment.phrases.push(currentPhrase);

          let insertedTags = '';
          if (!parsedLine.arrayTag?.value) {
            insertedTags += `#${momentId}`;
          }
          if (!parsedLine.arrayTag2?.value) {
            insertedTags += `#${phraseId} `;
          }
          if (insertedTags) {
            result.edits.push({
              newText: insertedTags,
              start: parsedLine.indicator!.end,
              end: parsedLine.indicator!.end,
            });
          }
          // Handle mote autocompltes
          if (
            !insertedTags &&
            parsedLine.sep &&
            (!parsedLine.moteName || !parsedLine.moteTag)
          ) {
            const where = {
              start: parsedLine.sep.end,
              end: parsedLine.emojiGroup?.start || lineRange.end,
            };
            result.completions.push({
              type: 'motes',
              options: characters,
              ...where,
            });
            if (!parsedLine.moteTag) {
              result.diagnostics.push({
                message: `Mote required!`,
                ...where,
              });
            } else if (!packed.working.getMote(parsedLine.moteTag.value!)) {
              result.diagnostics.push({
                message: `Mote not found!`,
                ...where,
              });
            }
          }
        }
      } else if (indicator === '>') {
        // Then we've got a line of dialogue! Unlike quests/idles, there is no array tag to deal with.
        if (!isInMoments) {
          result.diagnostics.push({
            message: `Not inside the Moments section!`,
            ...lineRange,
          });
        } else if (!currentPhrase) {
          result.diagnostics.push({
            message: `Dialogue requires a speaker header!`,
            ...lineRange,
          });
        } else {
          const emoji = helpers.emojiIdFromName(parsedLine.emojiName?.value);
          currentPhrase.text = parsedLine.text?.value;
          currentPhrase.emoji = emoji;
          if (parsedLine.emojiGroup) {
            // Emojis are optional. If we see a "group" (parentheses) then
            // that changes to a requirement.
            requiresEmoji = {
              at: changedPosition(parsedLine.emojiGroup.start, {
                characters: 1,
              }),
              options: helpers.emojis,
            };
          }
          helpers.checkSpelling(parsedLine.text);
        }
      }
      // fallthrough (error) case
      else {
        // Then we're in an error state on this line!
        result.diagnostics.push({
          message: `Unfamiliar syntax: ${line}`,
          ...lineRange,
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
        } else if (!helpers.emojiIdFromName(parsedLine.emojiName?.value)) {
          result.diagnostics.push({
            message: `Emoji "${parsedLine.emojiName?.value}" not found!`,
            ...where,
          });
        }
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

export async function updateChangesFromParsedChat(
  parsed: ChatUpdateResult['parsed'],
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
    const moteWorking = packed.working.getMote(moteId);
    const moteBase = packed.base.getMote(moteId) as ChatMote | undefined;
    assert(moteWorking, `Mote ${moteId} not found in working copy`);
    const schema = packed.working.getSchema(moteWorking.schema_id);
    assert(schema, `${moteWorking.schema_id} schema not found in working copy`);
    assert(schema.name, 'Chat mote must have a name pointer');

    const updateMote = (path: ChatMoteDataPointer, value: any) => {
      packed.updateMoteData(moteId, path, value);
    };

    updateMote('data/name', parsed.name);
    updateWipChangesFromParsed(parsed, moteId, packed, trace);

    // Add/Update IDLES
    trace(`Updating idles`);

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
