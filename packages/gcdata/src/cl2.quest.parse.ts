import { GameChanger } from './GameChanger.js';
import { assert } from './assert.js';
import { QuestMoteDataPointer } from './cl2.quest.pointers.js';
import {
  linePatterns,
  ParsedClue,
  ParsedDialog,
  ParsedEmoteGroup,
  QuestMomentsLabel,
  QuestRequirementsLabel,
  QuestUpdateResult,
} from './cl2.quest.types.js';
import {
  getMomentStyleNames,
  getMoteLists,
  getRequirementQuestStatuses,
  getRequirementStyleNames,
  getStagingOptions,
  isEmoteMoment,
} from './cl2.quest.utils.js';
import {
  arrayTagPattern,
  lineIsArrayItem,
  ParsedLine,
  parseIfMatch,
} from './cl2.shared.types.js';
import { Crashlands2 } from './cl2.types.auto.js';
import {
  bsArrayToArray,
  changedPosition,
  createBsArrayKey,
  updateBsArrayOrder,
} from './helpers.js';
import type { ParsedLineItem, Position } from './types.editor.js';
import { Mote } from './types.js';
import { checkWords, includes } from './util.js';

export function parseStringifiedQuest(
  text: string,
  packed: GameChanger,
  options: {
    checkSpelling?: boolean;
  } = {},
): QuestUpdateResult {
  const motes = getMoteLists(packed.working);
  const momentStyles = getMomentStyleNames(packed.working);
  // Remove 'Dialogue' and 'Emote' from the list of moment styles
  for (const style of ['Dialogue', 'Emote']) {
    momentStyles.splice(momentStyles.indexOf(style), 1);
  }
  const requirementStyles = getRequirementStyleNames(packed.working);
  const stagingOptions = getStagingOptions(packed.working);
  const requirementQuestStatuses = getRequirementQuestStatuses(packed.working);
  const requirementCompletions = [...requirementStyles];
  requirementCompletions.splice(requirementCompletions.indexOf('Quest'), 1);
  requirementCompletions.push(
    ...requirementQuestStatuses.map((s) => `Quest ${s}`),
  );

  /**
   * Shared list of keywords that can be used at the start of any line,
   * with required-unique entries removed when found.
   */
  const nonUniqueGlobalLabels = new Set<string>(['Clue']);
  const availableGlobalLabels = new Set<string>([
    'Stage',
    'Name',
    'Storyline',
    'Giver',
    'Receiver',
    'Clue',
    'Start Requirements',
    'Start Moments',
    'End Requirements',
    'End Moments',
    'Log',
  ]);

  /** Terms from the glossary for use in autocompletes */
  const glossaryTerms = (packed.glossary?.relevantTerms() || []).map(
    (t) => t.text,
  );

  const result: QuestUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
    words: [],
    parsed: {
      clues: [],
      quest_end_moments: [],
      quest_start_moments: [],
      quest_start_requirements: [],
      quest_end_requirements: [],
      comments: [],
    },
  };

  const lines = text.split(/(\r?\n)/g);

  let index = 0;
  let lineNumber = 0;

  const emojiIdFromName = (name: string | undefined): string | undefined => {
    if (!name) {
      return undefined;
    }
    const emoji = motes.emojis.find(
      (e) =>
        packed.working.getMoteName(e)?.toLowerCase() ===
          name?.trim().toLowerCase() || e.id === name?.trim(),
    );
    return emoji?.id;
  };

  const checkSpelling = (item: ParsedLineItem<any> | undefined) => {
    if (!item || !options.checkSpelling || !packed.glossary) return;
    result.words.push(...checkWords(item, packed.glossary));
  };

  /** The MoteId for the last speaker we saw. Used to figure out who to assign stuff to */
  let lastSpeaker: undefined | string;
  let lastClue: undefined | ParsedClue;
  let lastSectionGroup: QuestMomentsLabel | QuestRequirementsLabel | undefined;
  let lastEmojiGroup: undefined | ParsedEmoteGroup;

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
        const pos = {
          start: lineRange.start,
          end: lineRange.end,
        };
        result.completions.push({
          type: 'labels',
          options: availableGlobalLabels,
          ...pos,
        });
        if (isQuestMomentLabel(lastSectionGroup)) {
          result.completions.push({
            type: 'momentStyles',
            options: momentStyles,
            ...pos,
          });
        } else if (isQuestRequirementLabel(lastSectionGroup)) {
          result.completions.push({
            type: 'requirementStyles',
            options: requirementCompletions,
            ...pos,
          });
        }
        continue;
      }

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

      // If this has a label, remove it from the list of available labels
      if (
        parsedLine.label?.value &&
        availableGlobalLabels.has(parsedLine.label.value) &&
        !nonUniqueGlobalLabels.has(parsedLine.label.value)
      ) {
        availableGlobalLabels.delete(parsedLine.label.value);
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

      // Track common problems so that we don't need to repeat logic
      /** The character where a mote should exist. */
      let requiresMote: undefined | { at: Position; options: Mote[] };
      let requiresEmoji: undefined | { at: Position; options: Mote[] };

      // Work through each line type to add diagnostics and completions
      const labelLower = parsedLine.label?.value?.toLowerCase();
      const indicator = parsedLine.indicator?.value;

      // Resets
      if (indicator !== '>') {
        // Then we need to reset the speaker
        lastSpeaker = undefined;
        lastClue = undefined;
      }
      if (indicator !== '!') {
        lastEmojiGroup = undefined;
      }

      // Parsing
      if (labelLower === 'start moments') {
        lastSectionGroup = 'quest_start_moments';
      } else if (labelLower === 'end moments') {
        lastSectionGroup = 'quest_end_moments';
      } else if (labelLower === 'start requirements') {
        lastSectionGroup = 'quest_start_requirements';
      } else if (labelLower === 'end requirements') {
        lastSectionGroup = 'quest_end_requirements';
      }

      if (indicator === '\t') {
        // No data gets stored here, this is just a convenience marker
        // to set the speaker for the next set of dialog lines.
        requiresMote = {
          at: parsedLine.indicator!.end,
          options: motes.allowedSpeakers,
        };
        lastSpeaker = parsedLine.moteTag?.value;
      } else if (labelLower === 'clue') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedSpeakers,
        };
        lastClue = {
          id: parsedLine.arrayTag?.value?.trim(),
          speaker: parsedLine.moteTag?.value?.trim(),
          phrases: [],
        };
        result.parsed.clues ||= [];
        result.parsed.clues.push(lastClue);
      } else if (indicator === '>') {
        // Then this is a dialog line, either within a Clue or a Dialog Moment
        const emoji = emojiIdFromName(parsedLine.emojiName?.value);
        if (parsedLine.emojiGroup) {
          // Emojis are optional. If we see a "group" (parentheses) then
          // that changes to a requirement.
          requiresEmoji = {
            at: changedPosition(parsedLine.emojiGroup.start, { characters: 1 }),
            options: motes.emojis,
          };
        }
        checkSpelling(parsedLine.text);
        const moment: ParsedDialog = {
          kind: 'dialogue',
          id: parsedLine.arrayTag?.value?.trim(),
          speaker: lastSpeaker,
          emoji,
          text: parsedLine.text?.value?.trim() || '',
        };
        if (lastClue) {
          lastClue.phrases.push(moment);
        } else if (isQuestMomentLabel(lastSectionGroup)) {
          result.parsed[lastSectionGroup].push(moment);
        } else {
          // Then this is an error!
          result.diagnostics.push({
            message: `Dialog line without a Clue or Moment!`,
            ...lineRange,
          });
        }
      } else if (labelLower === 'name') {
        result.parsed.name = parsedLine.text?.value?.trim();
        if (!result.parsed.name) {
          result.diagnostics.push({
            message: `Quest name required!`,
            ...lineRange,
          });
        }
      } else if (labelLower === 'stage') {
        const stage = parsedLine.text?.value?.trim();
        if (includes(stagingOptions, stage)) {
          result.parsed.stage = stage;
        } else {
          result.diagnostics.push({
            message: `Stage must be one of: ${stagingOptions.join(', ')}`,
            ...lineRange,
          });
          // Provide autocomplete options
          result.completions.push({
            type: 'stages',
            options: stagingOptions,
            start: parsedLine.labelGroup!.end,
            end: lineRange.end,
          });
        }
      } else if (labelLower === 'log') {
        result.parsed.quest_start_log = parsedLine.text?.value?.trim();
        checkSpelling(parsedLine.text);
      } else if (labelLower === 'storyline') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.storylines,
        };
        result.parsed.storyline = parsedLine.moteTag?.value?.trim();
      } else if (labelLower === 'giver') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedGivers,
        };
        result.parsed.quest_giver = parsedLine.moteTag?.value?.trim();
      } else if (labelLower === 'receiver') {
        requiresMote = {
          at: parsedLine.labelGroup!.end,
          options: motes.allowedGivers,
        };
        result.parsed.quest_receiver = parsedLine.moteTag?.value?.trim();
      } else if (indicator === ':)') {
        if (isQuestMomentLabel(lastSectionGroup)) {
          // Then this is a declaration line for an Emote moment
          // Create the new emoji group
          lastEmojiGroup = {
            kind: 'emote',
            id: parsedLine.arrayTag?.value?.trim(),
            emotes: [],
          };
          result.parsed[lastSectionGroup].push(lastEmojiGroup);
        } else {
          result.diagnostics.push({
            message: `Must be defined in a Start/End Moments section!`,
            ...lineRange,
          });
        }
      } else if (indicator === '!') {
        // Then this is an emote within a Emote moment

        if (lastEmojiGroup) {
          // Add speaker autocompletes
          if (parsedLine.sep) {
            requiresMote = {
              at: parsedLine.sep!.end,
              options: motes.allowedSpeakers,
            };
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Space required after the prefix.`,
              ...lineRange,
            });
          }
          // Add emoji autocompletes
          if (parsedLine.emojiGroup) {
            requiresEmoji = {
              at: changedPosition(parsedLine.emojiGroup.start, {
                characters: 1,
              }),
              options: motes.emojis,
            };
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Emoji required after the speaker.`,
              ...lineRange,
            });
          }
          lastEmojiGroup.emotes.push({
            id: parsedLine.arrayTag?.value?.trim(),
            speaker: parsedLine.moteTag?.value?.trim(),
            emoji: emojiIdFromName(parsedLine.emojiName?.value),
          });
        } else {
          result.diagnostics.push({
            message: `Missing an Emote declaration line!`,
            ...lineRange,
          });
        }
      } else if (indicator === '?') {
        // Then this is a non-dialog quest moment. These are not implemented, but should be available as placeholders.
        if (isQuestMomentLabel(lastSectionGroup)) {
          // Put an autocomplete after the "?#meh " prefix
          if (parsedLine.sep) {
            result.completions.push({
              type: 'momentStyles',
              options: momentStyles,
              start: parsedLine.sep!.end,
              end: parsedLine.sep!.end,
            });
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Space required after the prefix.`,
              ...lineRange,
            });
          }

          // Add to data if this momentStyle actually exists
          if (momentStyles.includes(parsedLine.style?.value as any)) {
            result.parsed[lastSectionGroup].push({
              kind: 'other',
              id: parsedLine.arrayTag?.value?.trim(),
              style: parsedLine.style?.value as any,
            });
          } else {
            result.diagnostics.push({
              message: `Unknown moment style "${parsedLine.style?.value}"`,
              ...lineRange,
            });
          }
        } else if (isQuestRequirementLabel(lastSectionGroup)) {
          // Put an autocomplete after the "?#meh " prefix
          if (parsedLine.sep) {
            result.completions.push({
              type: 'requirementStyles',
              options: requirementCompletions,
              start: parsedLine.sep!.end,
              end: parsedLine.sep!.end,
            });
          } else {
            result.diagnostics.push({
              message: `Invalid syntax. Space required after the prefix.`,
              ...lineRange,
            });
          }

          const style = parsedLine.style?.value;
          const isValidStyle = requirementStyles.includes(style as any);
          const isQuest = style === 'Quest';
          const hasValidQuestStatus = requirementQuestStatuses.includes(
            parsedLine.status?.value as any,
          );

          // Autocomplete Quests
          if (isQuest) {
            const canProvideAutocomplete = !!parsedLine.sep;
            if (canProvideAutocomplete) {
              requiresMote = {
                at: parsedLine.sep!.end,
                options: motes.quests,
              };
            } else {
              result.diagnostics.push({
                message: `Invalid syntax. Space required after the prefix.`,
                ...lineRange,
              });
            }
          }

          // Add to parsed data
          if (isQuest) {
            if (hasValidQuestStatus) {
              result.parsed[lastSectionGroup].push({
                kind: 'quest',
                style: 'Quest',
                id: parsedLine.arrayTag?.value?.trim(),
                quest: parsedLine.moteTag?.value?.trim(),
                status: parsedLine.status?.value as any,
              });
            } else {
              result.diagnostics.push({
                message: `Unknown quest status "${parsedLine.status?.value}"`,
                ...lineRange,
              });
            }
          } else if (isValidStyle) {
            result.parsed[lastSectionGroup].push({
              kind: 'other',
              id: parsedLine.arrayTag?.value?.trim(),
              style: style!,
            });
          } else {
            result.diagnostics.push({
              message: `Unknown requirement style "${style}"`,
              ...lineRange,
            });
          }
        } else {
          result.diagnostics.push({
            message: `Must be defined in a Start/End Moments/Requirements section!`,
            ...lineRange,
          });
        }
      } else if (indicator === '//') {
        // Then this is a comment/note
        result.parsed.comments.push({
          id: parsedLine.arrayTag?.value?.trim(),
          text: parsedLine.text?.value?.trim(),
        });
        checkSpelling(parsedLine.text);
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
        } else if (!emojiIdFromName(parsedLine.emojiName?.value)) {
          result.diagnostics.push({
            message: `Emoji "${parsedLine.emojiName?.value}" not found!`,
            ...where,
          });
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
          } else if (!packed.working.getMote(parsedLine.moteTag.value!)) {
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

export async function updateChangesFromParsedQuest(
  parsed: QuestUpdateResult['parsed'],
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
    const questMoteBase = packed.base.getMote(moteId) as
      | Mote<Crashlands2.Schemas['cl2_quest']>
      | undefined;
    const questMoteWorking = packed.working.getMote(moteId) as
      | Mote<Crashlands2.Schemas['cl2_quest']>
      | undefined;
    const schema = packed.working.getSchema('cl2_quest')!;
    assert(schema.name, 'Quest mote must have a name pointer');
    assert(schema, 'cl2_quest schema not found in working copy');
    const updateMote = (path: QuestMoteDataPointer, value: any) => {
      packed.updateMoteData(moteId, path, value);
    };
    updateMote('data/name', parsed.name);
    if (!parsed.quest_giver) {
      // Then we need to delete the entire quest_giver field
      updateMote('data/quest_giver', null);
    } else {
      updateMote('data/quest_giver/item', parsed.quest_giver);
    }
    if (!parsed.quest_receiver) {
      // Then we need to delete the entire quest_receiver field
      updateMote('data/quest_receiver', null);
    } else {
      updateMote('data/quest_receiver/item', parsed.quest_receiver);
    }
    updateMote('data/quest_start_log/text', parsed.quest_start_log);
    updateMote('data/storyline', parsed.storyline);

    if (parsed.stage) {
      updateMote('data/wip/staging', parsed.stage);
    } else if (questMoteWorking?.data.wip) {
      updateMote('data/wip/staging', null);
    }

    const parsedComments = parsed.comments.filter((c) => !!c.text);
    const parsedClues = parsed.clues.filter((c) => !!c.id && !!c.speaker);

    //#region COMMENTS
    // Add/Update COMMENTS
    trace(`Updating comments`);
    for (const comment of parsedComments) {
      trace(`Updating comment ${comment.id} with text "${comment.text}"`);
      updateMote(`data/wip/notes/${comment.id}/element/text`, comment.text);
    }
    // Remove deleted comments
    for (const existingComment of bsArrayToArray(
      questMoteBase?.data.wip?.notes || {},
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
      let comment = questMoteBase?.data.wip?.notes?.[c.id!];
      if (!comment) {
        comment = questMoteWorking?.data.wip?.notes?.[c.id!];
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
      updateMote(`data/wip/notes/${comment.id}/order`, comment.order);
    });
    //#endregion

    //#region CLUES
    // Add/update clues
    trace(`Updating clues`);
    for (const clue of parsedClues) {
      trace(`Setting clue ${clue.id} speaker to "${clue.speaker}"`);
      updateMote(`data/clues/${clue.id}/element/speaker`, clue.speaker);
      for (const phrase of clue.phrases) {
        trace(`Setting phrase ${phrase.id} text to "${phrase.text}"`);
        updateMote(
          `data/clues/${clue.id}/element/phrases/${phrase.id}/element/phrase/text/text`,
          phrase.text || '',
        );
        if (phrase.emoji) {
          trace(`Setting phrase ${phrase.id} emoji to "${phrase.emoji}"`);
          updateMote(
            `data/clues/${clue.id}/element/phrases/${phrase.id}/element/phrase/emoji`,
            phrase.emoji,
          );
        }
      }
    }
    // Delete clues that were removed
    trace(`Deleting removed clues`);
    for (const existingClue of bsArrayToArray(
      questMoteBase?.data.clues || {},
    )) {
      const parsedClue = parsedClues.find((c) => c.id === existingClue.id);
      if (!parsedClue) {
        trace(`Deleting clue ${existingClue.id}`);
        updateMote(`data/clues/${existingClue.id}`, null);
      } else {
        // Delete phrases that were removed
        for (const existingPhrase of bsArrayToArray(
          existingClue.element.phrases,
        )) {
          if (!parsedClue.phrases.find((p) => p.id === existingPhrase.id)) {
            trace(
              `Deleting phrase ${existingPhrase.id} from clue ${existingClue.id}`,
            );
            updateMote(
              `data/clues/${existingClue.id}/element/phrases/${existingPhrase.id}`,
              null,
            );
          }
        }
      }
    }
    // Update the order of the clues and phrases
    trace(`Updating clue order`);
    const clues = parsedClues.map((c) => {
      // Look up the base clue
      let clue = questMoteBase?.data.clues?.[c.id!];
      if (!clue) {
        clue = questMoteWorking?.data.clues?.[c.id!];
        // @ts-expect-error - order is a required field, but it'll be re-added
        delete clue?.order;
      }
      assert(clue, `Clue ${c.id} not found in base or working mote`);
      const phrases = c.phrases.map((p) => {
        let phrase =
          questMoteBase?.data.clues?.[c.id!]?.element?.phrases?.[p.id!];
        if (!phrase) {
          phrase =
            questMoteWorking?.data.clues?.[c.id!]?.element?.phrases?.[p.id!];
          // @ts-expect-error - order is a required field, but it'll be re-added
          delete phrase?.order;
        }
        assert(phrase, `Phrase ${p.id} not found in base or working mote`);
        return { ...phrase, id: p.id! };
      });
      trace(`Updating phrase order for clue ${c.id}`);
      updateBsArrayOrder(phrases);
      return { ...clue, phrases, id: c.id! };
    });
    updateBsArrayOrder(clues);
    clues.forEach((clue) => {
      trace(`Updating clue ${clue.id} order to ${clue.order}`);
      updateMote(`data/clues/${clue.id}/order`, clue.order);
      clue.phrases.forEach((phrase) => {
        trace(`Updating phrase ${phrase.id} order to ${phrase.order}`);
        updateMote(
          `data/clues/${clue.id}/element/phrases/${phrase.id}/order`,
          phrase.order,
        );
      });
    });
    //#endregion

    for (const requirementGroup of [
      'quest_start_requirements',
      'quest_end_requirements',
    ] as const) {
      trace(`Updating Requirement Group ${requirementGroup}`);
      const parsedRequirements = parsed[requirementGroup];
      // Add/Update requirements
      trace('Adding/updating requirements');
      for (const requirement of parsedRequirements) {
        trace(`Updating requirement ${requirement.id}`);
        updateMote(
          `data/${requirementGroup}/${requirement.id}/element/style`,
          requirement.style,
        );
        if (requirement.kind === 'quest') {
          updateMote(
            `data/${requirementGroup}/${requirement.id}/element/quest`,
            requirement.quest,
          );
          updateMote(
            `data/${requirementGroup}/${requirement.id}/element/quest_status`,
            requirement.status,
          );
        }
      }
      // Delete requirements that were removed
      trace('Deleting removed requirements');
      for (const existingRequirement of bsArrayToArray(
        questMoteBase?.data[requirementGroup] || {},
      )) {
        const parsedRequirement = parsedRequirements.find(
          (r) => r.id === existingRequirement.id,
        );
        if (!parsedRequirement) {
          trace(`Deleting removed requirement ${existingRequirement.id}`);
          updateMote(
            `data/${requirementGroup}/${existingRequirement.id}`,
            null,
          );
        }
      }
      // Update the requirement order
      trace('Updating requirement order');
      const requirements = parsedRequirements.map((r) => {
        let requirement = questMoteBase?.data[requirementGroup]?.[r.id!];
        if (!requirement) {
          requirement = questMoteWorking?.data[requirementGroup]?.[r.id!];
          // @ts-expect-error - order is a required field, but it'll be re-added
          delete requirement?.order;
        }
        assert(
          requirement,
          `Requirement ${r.id} not found in base or working mote`,
        );
        return { ...requirement, id: r.id! };
      });
      updateBsArrayOrder(requirements);
      requirements.forEach((r) => {
        trace(`Updating requirement ${r.id} order to ${r.order}`);
        updateMote(`data/${requirementGroup}/${r.id}/order`, r.order);
      });
    }

    //#region QUEST MOMENTS
    for (const momentGroup of [
      'quest_start_moments',
      'quest_end_moments',
    ] as const) {
      trace(`Updating Moment Group ${momentGroup}`);
      const parsedMoments = parsed[momentGroup];
      // Add/Update moments
      trace('Adding/updating moments');
      for (const moment of parsedMoments) {
        trace(`Updating moment ${moment.id} of kind ${moment.kind}`);
        const setStyle = (style: string) =>
          updateMote(`data/${momentGroup}/${moment.id}/element/style`, style);
        if (moment.kind === 'other') {
          // Note: we're only tracking style for moment types that
          // are not fully implemented.
          setStyle(moment.style!);
        } else if (moment.kind === 'dialogue') {
          trace('Updating speaker');
          setStyle('Dialogue');
          updateMote(
            `data/${momentGroup}/${moment.id}/element/speech/speaker`,
            moment.speaker,
          );
          trace('Updating emoji');
          updateMote(
            `data/${momentGroup}/${moment.id}/element/speech/emotion`,
            moment.emoji,
          );
          trace('Updating text');
          updateMote(
            `data/${momentGroup}/${moment.id}/element/speech/text/text`,
            moment.text,
          );
        } else if (moment.kind === 'emote') {
          setStyle('Emote');
          for (const emote of moment.emotes) {
            updateMote(
              `data/${momentGroup}/${moment.id}/element/emotes/${emote.id}/element/key`,
              emote.speaker,
            );
            updateMote(
              `data/${momentGroup}/${moment.id}/element/emotes/${emote.id}/element/value`,
              emote.emoji,
            );
          }
        }
        trace(`Updated moment ${moment.id}`);
      }
      // Delete moments that were removed
      trace('Deleting removed moments');
      for (const existingMoment of bsArrayToArray(
        questMoteBase?.data[momentGroup] || {},
      )) {
        const parsedMoment = parsedMoments.find(
          (m) => m.id === existingMoment.id,
        );
        const existingElement = existingMoment.element;
        if (!parsedMoment) {
          trace(`Deleting removed moment ${existingMoment.id}`);
          updateMote(`data/${momentGroup}/${existingMoment.id}`, null);
        } else if (existingElement.style === 'Emote') {
          // Delete emotes that were removed
          trace(`Deleting removed emotes from moment ${existingMoment.id}`);
          assert(
            parsedMoment.kind === 'emote',
            `Expected moment ${existingMoment.id} to be an emote`,
          );
          for (const existingEmote of bsArrayToArray(existingElement.emotes)) {
            if (!parsedMoment.emotes.find((e) => e.id === existingEmote.id)) {
              trace(
                `Deleting removed emote ${existingEmote.id} from moment ${existingMoment.id}`,
              );
              updateMote(
                `data/${momentGroup}/${existingMoment.id}/element/emotes/${existingEmote.id}`,
                null,
              );
            }
          }
        }
      }
      // Update the order of the moments
      trace('Updating moment order');
      const moments = parsedMoments.map((m) => {
        // Look up the base moment
        let moment = questMoteBase?.data[momentGroup]?.[m.id!];
        if (!moment) {
          moment = questMoteWorking?.data[momentGroup]?.[m.id!];
          // @ts-expect-error - order is a required field, but it'll be re-added
          delete moment?.order;
        }
        assert(moment, `Moment ${m.id} not found in base or working mote`);
        moment.element.style;
        const element = moment.element;
        if (element.style === 'Emote') {
          assert(m.kind === 'emote', `Expected moment ${m.id} to be an emote`);
          // Then make sure the emotes are in the right order
          const emotes = m.emotes.map((e) => {
            let emoteElement =
              questMoteBase?.data[momentGroup]?.[m.id!]?.element;
            let emote: Crashlands2.Emotes1[string] | undefined;
            if (emoteElement && isEmoteMoment(emoteElement)) {
              emote = emoteElement.emotes[e.id!];
            }
            if (!emote) {
              emoteElement =
                questMoteWorking?.data[momentGroup]?.[m.id!]?.element;
              if (emoteElement && isEmoteMoment(emoteElement)) {
                emote = emoteElement.emotes[e.id!];
              }
              // Then we don't need to try to keep a prior order value
              delete emote?.order;
            }
            assert(emote, `Emote ${e.id} not found in base or working mote`);
            return { ...emote, id: e.id! };
          });
          trace(`Updating emote order for moment ${m.id}`);
          updateBsArrayOrder(emotes);
          return { ...moment, emotes, id: m.id! };
        }
        return { ...moment, id: m.id! };
      });
      updateBsArrayOrder(moments);
      moments.forEach((m) => {
        trace(`Updating moment ${m.id} order to ${m.order}`);
        updateMote(`data/${momentGroup}/${m.id}/order`, m.order);
        if ('emotes' in m) {
          m.emotes.forEach((e) => {
            trace(`Updating emote ${e.id} order to ${e.order}`);
            updateMote(
              `data/${momentGroup}/${m.id}/element/emotes/${e.id}/order`,
              e.order,
            );
          });
        }
      });
    }
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

function isQuestRequirementLabel(
  label: string | undefined,
): label is QuestRequirementsLabel {
  return !!(label?.startsWith('quest_') && label.endsWith('_requirements'));
}

function isQuestMomentLabel(
  label: string | undefined,
): label is QuestMomentsLabel {
  return !!(label?.startsWith('quest_') && label.endsWith('_moments'));
}
