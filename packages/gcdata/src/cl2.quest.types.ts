import type { Gcdata } from './GameChanger.js';
import {
  arrayTagPattern,
  commentLinePattern,
  dialogPattern,
  emojiGroupPattern,
  moteNamePattern,
  moteTagPattern,
  ParserResult,
  QuestData,
  QuestMote,
  questSchemaId,
} from './cl2.shared.types.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import type { Mote } from './types.js';

export function listQuests(gcData: Gcdata): QuestMote[] {
  return gcData.listMotesBySchema<QuestData>(questSchemaId);
}

export function isQuestMote(mote: any): mote is Mote<Crashlands2.Quest> {
  return mote.schema_id === questSchemaId;
}

export interface ParsedClue {
  /** arrayId */
  id: string | undefined;
  /** Speaker MoteId */
  speaker: string | undefined;
  phrases: {
    /** arrayId */
    id: string | undefined;
    /** MoteId for the Emoji */
    emoji?: string;
    text: string;
  }[];
}

export interface ParsedEmote {
  /** arrayId */
  id: string | undefined;
  /** MoteId for the Emoji */
  emoji: string | undefined;
  /** MoteId for the speaker */
  speaker: string | undefined;
}

export interface ParsedEmoteGroup {
  kind: 'emote';
  /** arrayId */
  id: string | undefined;
  emotes: ParsedEmote[];
}

export interface ParsedOtherMoment {
  kind: 'other';
  id: string | undefined;
  style: string | undefined;
}

export interface ParsedDialog {
  kind: 'dialogue';
  /** arrayId */
  id: string | undefined;
  speaker: string | undefined;
  /** MoteId for the Emoji */
  emoji?: string;
  text: string;
}

export interface ParsedRequirementQuest {
  kind: 'quest';
  id: string | undefined;
  /** The MoteId of the required quest */
  quest: string | undefined;
  status: Crashlands2.QuestStatus;
  style: 'Quest';
}

export interface ParsedRequirementOther {
  kind: 'other';
  id: string | undefined;
  style: string;
}

type ParsedMoment = ParsedEmoteGroup | ParsedDialog | ParsedOtherMoment;

type ParsedRequirement = ParsedRequirementQuest | ParsedRequirementOther;

export type QuestMomentsLabel = `quest_${'start' | 'end'}_moments`;
export type QuestRequirementsLabel = `quest_${'start' | 'end'}_requirements`;

export interface QuestUpdateResult
  extends ParserResult<
    {
      /** The moteId for the storyline */
      storyline?: string;
      /** The moteId for the quest giver */
      quest_giver?: string;
      /** The moteId for the quest receiver */
      quest_receiver?: string;
      clues: ParsedClue[];
      quest_start_log?: string;
    } & {
      [K in QuestMomentsLabel]: ParsedMoment[];
    } & {
      [K in QuestRequirementsLabel]: ParsedRequirement[];
    }
  > {}

export type Section = (typeof sections)[number];
export const sections = ['start moments', 'end moments'] as const;

export const linePatterns = [
  /** Label:Text */
  `^(?<labelGroup>(?<label>Name|Log|Stage)\\s*:)\\s*(?<text>.*?)\\s*$`,
  /** Labeled Mote */
  `^(?<labelGroup>(?<label>[\\w ]+)${arrayTagPattern}?\\s*:)\\s*(${moteNamePattern}${moteTagPattern}?)?\\s*$`,
  /** Dialogue Speaker */
  `^(?<indicator>\\t)(${moteNamePattern}${moteTagPattern}?)?\\s*$`,
  /** Dialogue Text */
  dialogPattern,
  /** Comment Line */
  commentLinePattern,
  /** Emote Declaration */
  `^(?<indicator>:\\))\\s*${arrayTagPattern}?\\s*$`,
  /** Emote */
  `^(?<indicator>!)\\s*?${arrayTagPattern}?(?<sep>\\s+)(${moteNamePattern}${moteTagPattern}\\s+${emojiGroupPattern})?\\s*$`,
  /** Requirement: Quest */
  // for e.g. `?#qpzc Quest Complete: Square Shaped@q_petget1_rc_c0_n5_2d`
  `^(?<indicator>\\?)\\s*${arrayTagPattern}?\\s+(?<style>Quest)\\s+(?<status>Complete|Started|Not Started)\\s*:(?<sep>\\s+)(${moteNamePattern}${moteTagPattern}?)?$`,
  /** Non-Dialog Moment */
  `^(?<indicator>\\?)\\s*?${arrayTagPattern}?(?<sep>\\s+)(?<style>.*?)?\\s*$`,
];
