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
} from './cl2.shared.parse.js';
import { npcSchemaId } from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { changedPosition } from './helpers.js';
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
      globalLabels: new Set(['Stage', 'Name', 'Idle Dialologue']),
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

      console.log('PARSED LINE', parsedLine);

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
            name: parsedLine.label?.value?.trim(),
            phrases: [],
          };
          lastIdleTopic.groups.push(lastPhraseGroup);
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

  console.log(result.parsed);
  return result;
}

export async function updateChangesFromParsedCharacter(
  parsed: CharacterUpdateResult['parsed'],
  moteId: string,
  packed: GameChanger,
): Promise<never> {
  throw new Error('Not implemented');
}
