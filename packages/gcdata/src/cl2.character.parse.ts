import { assert } from './assert.js';
import { CharacterMoteDataPointer } from './cl2.character.pointers.js';
import {
  linePatterns,
  ParsedGroup,
  ParsedTopic,
  type CharacterUpdateResult,
} from './cl2.character.types.js';
import {
  isCommentLine,
  isStageLine,
  prepareParserHelpers,
  updateWipChangesFromParsed,
} from './cl2.shared.parse.js';
import { CharacterMote, npcSchemaId } from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import {
  bsArrayToArray,
  changedPosition,
  updateBsArrayOrder,
} from './helpers.js';
import { Position } from './types.editor.js';
import { Mote } from './types.js';

export function parseStringifiedCharacter(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
): CharacterUpdateResult {
  const result: CharacterUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
    words: [],
    parsed: {
      comments: [],
      idles: [],
    },
  };

  const helpers = prepareParserHelpers(
    text,
    packed,
    {
      ...options,
      schemaId: npcSchemaId,
      globalLabels: new Set(['Stage', 'Name', 'Idle Dialogue']),
    },
    result,
  );

  // Track where we are for context-dependent lines
  /** True if we've hit the "Idle Dialogue" label */
  let inIdles = false;
  let lastIdleTopic: undefined | ParsedTopic;
  let lastPhraseGroup: undefined | ParsedGroup;

  for (const line of helpers.lines) {
    const trace: any[] = [];

    try {
      const lineRange = helpers.currentLineRange;

      // Is this just a blank line?
      if (!line) {
        if (inIdles) {
          result.completions.push({
            type: 'labels',
            options: new Set('Topic'),
            start: lineRange.start,
            end: lineRange.end,
          });
        }
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
            message: `Character name required!`,
            ...lineRange,
          });
        }
      } else if (isStageLine(parsedLine)) {
        helpers.addStage(parsedLine);
      } else if (labelLower === 'idle dialogue') {
        if (inIdles) {
          result.diagnostics.push({
            message: `Already in Idle Dialogue!`,
            ...lineRange,
          });
        }
        inIdles = true;
      } else if (labelLower === 'topic') {
        // Then we're creating a new topic within the idle dialogue section
        if (!inIdles) {
          result.diagnostics.push({
            message: `Topics must be within Idle Dialogue!`,
            ...lineRange,
          });
        } else {
          lastIdleTopic = {
            id: parsedLine.arrayTag?.value?.trim(),
            name: parsedLine.text?.value?.trim(),
            groups: [],
          };
          result.parsed.idles.push(lastIdleTopic);
          // If we don't have a ':' separator, add it as an insert to help
          if (
            !parsedLine.sep &&
            parsedLine._hadArrayTag &&
            parsedLine.arrayTag?.value
          ) {
            // Put it right after the array tag
            result.edits.push({
              newText: ': ',
              start: parsedLine.arrayTag!.end,
              end: parsedLine.arrayTag!.end,
            });
          }
        }
      } else if (indicator === '\t') {
        // Then we're starting a phrase group within a topic
        if (!inIdles) {
          result.diagnostics.push({
            message: `Phrase Groups must be within a Topic!`,
            ...lineRange,
          });
        } else if (!lastIdleTopic) {
          result.diagnostics.push({
            message: `Phrase Groups must be within a Topic!`,
            ...lineRange,
          });
        } else {
          lastPhraseGroup = {
            id: parsedLine.arrayTag?.value?.trim(),
            name: parsedLine.text?.value?.trim(),
            phrases: [],
          };
          lastIdleTopic.groups.push(lastPhraseGroup);
          // If we don't have a ' ' separator, add it as an insert to help
          if (
            !parsedLine.sep &&
            parsedLine._hadArrayTag &&
            parsedLine.arrayTag?.value
          ) {
            // Put it right after the array tag
            result.edits.push({
              newText: ' ',
              start: parsedLine.arrayTag!.end,
              end: parsedLine.arrayTag!.end,
            });
          }
        }
      } else if (indicator === '>') {
        // Then we're adding a phrase to the current phrase group
        if (!inIdles) {
          result.diagnostics.push({
            message: `Phrases must be within a Phrase Group!`,
            ...lineRange,
          });
        } else if (!lastIdleTopic) {
          result.diagnostics.push({
            message: `Phrases must be within a Phrase Group!`,
            ...lineRange,
          });
        } else if (!lastPhraseGroup) {
          result.diagnostics.push({
            message: `Phrases must be within a Phrase Group!`,
            ...lineRange,
          });
        } else {
          const emoji = helpers.emojiIdFromName(parsedLine.emojiName?.value);
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
          lastPhraseGroup.phrases.push({
            id: parsedLine.arrayTag?.value?.trim(),
            emoji,
            text: parsedLine.text?.value?.trim(),
          });
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

export async function updateChangesFromParsedCharacter(
  parsed: CharacterUpdateResult['parsed'],
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
    const moteBase = packed.base.getMote(moteId) as CharacterMote | undefined;
    assert(moteWorking, `Mote ${moteId} not found in working copy`);
    const schema = packed.working.getSchema(moteWorking.schema_id);
    assert(schema, `${moteWorking.schema_id} schema not found in working copy`);
    assert(schema.name, 'Character mote must have a name pointer');

    const updateMote = (path: CharacterMoteDataPointer, value: any) => {
      packed.updateMoteData(moteId, path, value);
    };

    updateMote('data/name/text', parsed.name);
    updateWipChangesFromParsed(parsed, moteId, packed, trace);

    // Add/Update IDLES
    trace(`Updating idles`);
    const parsedIdleIds: Map<string, Map<string, Set<string>>> = new Map();
    for (const idle of parsed.idles) {
      assert(idle.id, `Idle must have an ID`);
      parsedIdleIds.set(idle.id, parsedIdleIds.get(idle.id) ?? new Map());
      const parsedGroupIds = parsedIdleIds.get(idle.id)!;
      const basePointer =
        `data/idle_text/${idle.id}` satisfies CharacterMoteDataPointer;
      updateMote(`${basePointer}/element/name`, idle.name);
      for (const group of idle.groups) {
        assert(group.id, `Phrase Group must have an ID`);
        parsedGroupIds.set(group.id, parsedGroupIds.get(group.id) ?? new Set());
        const parsedPhraseIds = parsedGroupIds.get(group.id)!;
        const groupPointer =
          `${basePointer}/element/phrase_groups/${group.id}` satisfies CharacterMoteDataPointer;
        updateMote(`${groupPointer}/element/name`, group.name);
        for (const phrase of group.phrases) {
          assert(phrase.id, `Phrase must have an ID`);
          parsedPhraseIds.add(phrase.id);
          const phrasePointer =
            `${groupPointer}/element/phrases/${phrase.id}` satisfies CharacterMoteDataPointer;
          updateMote(`${phrasePointer}/element/text/text`, phrase.text);
          if (phrase.emoji) {
            updateMote(`${phrasePointer}/element/emoji`, phrase.emoji);
          }
        }
      }
    }
    // Delete legacy phrases/groups/idles
    for (const existingIdle of bsArrayToArray(moteBase?.data.idle_text || {})) {
      let isInParsed = parsedIdleIds.has(existingIdle.id);
      if (!isInParsed) {
        trace(`Deleting idle ${existingIdle.id}`);
        updateMote(`data/idle_text/${existingIdle.id}`, null);
        continue;
      }
      const parsedGroups = parsedIdleIds.get(existingIdle.id)!;
      for (const existingGroup of bsArrayToArray(
        existingIdle.element?.phrase_groups || {},
      )) {
        isInParsed = parsedGroups.has(existingGroup.id);
        if (!isInParsed) {
          trace(`Deleting idle phrase group ${existingGroup.id}`);
          updateMote(
            `data/idle_text/${existingIdle.id}/element/phrase_groups/${existingGroup.id}`,
            null,
          );
          continue;
        }
        const parsedPhrases = parsedGroups.get(existingGroup.id)!;
        for (const existingPhrase of bsArrayToArray(
          existingGroup.element?.phrases || {},
        )) {
          isInParsed = parsedPhrases.has(existingPhrase.id);
          if (!isInParsed) {
            trace(`Deleting idle phrase ${existingPhrase.id}`);
            updateMote(
              `data/idle_text/${existingIdle.id}/element/phrase_groups/${existingGroup.id}/element/phrases/${existingPhrase.id}`,
              null,
            );
          }
        }
      }
    }
    // Update idle order (and internal order) -- computed first!
    const orderedIdles = parsed.idles.map((parsedIdle) => {
      assert(parsedIdle.id, `Idle must have an ID`);
      let idle = moteBase?.data.idle_text?.[parsedIdle.id];
      if (!idle) {
        idle = moteWorking.data.idle_text?.[parsedIdle.id];
        assert(idle, `Idle ${parsedIdle.id} not found in base or working`);
        // @ts-expect-error - order is a required field, but it'll be re-added
        delete idle?.order;
      }
      const orderedGroups = parsedIdle.groups.map((parsedGroup) => {
        assert(parsedGroup.id, `Group must have an ID`);
        let group = idle.element?.phrase_groups?.[parsedGroup.id];
        if (!group) {
          group =
            moteWorking?.data.idle_text?.[parsedIdle.id!]?.element
              ?.phrase_groups?.[parsedGroup.id];
          assert(
            group,
            `Group ${parsedGroup.id} not found in idle ${parsedIdle.id}`,
          );
          // @ts-expect-error - order is a required field, but it'll be re-added
          delete group?.order;
        }
        const orderedPhrases = parsedGroup.phrases.map((parsedPhrase) => {
          assert(parsedPhrase.id, `Phrase must have an ID`);
          let phrase = group.element?.phrases?.[parsedPhrase.id];
          if (!phrase) {
            phrase =
              moteWorking?.data.idle_text?.[parsedIdle.id!]?.element
                ?.phrase_groups?.[parsedGroup.id!]?.element?.phrases?.[
                parsedPhrase.id
              ];
            assert(
              phrase,
              `Phrase ${parsedPhrase.id} not found in group ${parsedGroup.id}`,
            );
            // @ts-expect-error - order is a required field, but it'll be re-added
            delete phrase?.order;
          }
          return { ...phrase, id: parsedPhrase.id };
        });
        updateBsArrayOrder(orderedPhrases);
        return { ...group, phrases: orderedPhrases, id: parsedGroup.id };
      });
      updateBsArrayOrder(orderedGroups);
      return { ...idle, phraseGroups: orderedGroups, id: parsedIdle.id };
    });
    updateBsArrayOrder(orderedIdles);
    // Now turn those order changes into mote updates
    for (const orderedIdle of orderedIdles) {
      trace(`Updating idle order ${orderedIdle.id} to ${orderedIdle.order}`);
      updateMote(`data/idle_text/${orderedIdle.id}/order`, orderedIdle.order);
      for (const orderedGroup of orderedIdle.phraseGroups) {
        trace(
          `Updating idle group order ${orderedGroup.id} to ${orderedGroup.order}`,
        );
        updateMote(
          `data/idle_text/${orderedIdle.id}/element/phrase_groups/${orderedGroup.id}/order`,
          orderedGroup.order,
        );
        for (const orderedPhrase of orderedGroup.phrases) {
          trace(
            `Updating idle phrase order ${orderedPhrase.id} to ${orderedPhrase.order}`,
          );
          updateMote(
            `data/idle_text/${orderedIdle.id}/element/phrase_groups/${orderedGroup.id}/element/phrases/${orderedPhrase.id}/order`,
            orderedPhrase.order,
          );
        }
      }
    }

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
