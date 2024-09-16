import type { Gcdata } from './GameChanger.js';
import {
  buddySchemaId,
  npcSchemaId,
  ParserResult,
  type BuddyData,
  type BuddyMote,
  type NpcData,
  type NpcMote,
} from './cl2.shared.types.js';
import type { Mote } from './types.js';

export function listNpcs(gcData: Gcdata): NpcMote[] {
  return gcData.listMotesBySchema<NpcData>(npcSchemaId);
}

export function listBuddies(gcData: Gcdata): BuddyMote[] {
  return gcData.listMotesBySchema<BuddyData>(buddySchemaId);
}

export function listCharacters(gcData: Gcdata): (BuddyMote | NpcMote)[] {
  const characters: (BuddyMote | NpcMote)[] = listBuddies(gcData);
  return characters.concat(listNpcs(gcData));
}

export function isCharacterMote(mote: any): mote is Mote<Gcdata | BuddyData> {
  return [buddySchemaId, npcSchemaId].includes(mote.schema_id);
}

export function isBuddyMote(mote: any): mote is Mote<BuddyData> {
  return mote.schema_id === buddySchemaId;
}

export function isNpcMote(mote: any): mote is Mote<NpcData> {
  return mote.schema_id === npcSchemaId;
}

export interface CharacterUpdateResult extends ParserResult<{}> {}

// export interface ParsedClue {
//   /** arrayId */
//   id: string | undefined;
//   /** Speaker MoteId */
//   speaker: string | undefined;
//   phrases: {
//     /** arrayId */
//     id: string | undefined;
//     /** MoteId for the Emoji */
//     emoji?: string;
//     text: string;
//   }[];
// }

// export interface ParsedEmote {
//   /** arrayId */
//   id: string | undefined;
//   /** MoteId for the Emoji */
//   emoji: string | undefined;
//   /** MoteId for the speaker */
//   speaker: string | undefined;
// }

// export interface ParsedEmoteGroup {
//   kind: 'emote';
//   /** arrayId */
//   id: string | undefined;
//   emotes: ParsedEmote[];
// }

// export interface ParsedOtherMoment {
//   kind: 'other';
//   id: string | undefined;
//   style: string | undefined;
// }

// export interface ParsedDialog {
//   kind: 'dialogue';
//   /** arrayId */
//   id: string | undefined;
//   speaker: string | undefined;
//   /** MoteId for the Emoji */
//   emoji?: string;
//   text: string;
// }

// export interface ParsedRequirementQuest {
//   kind: 'quest';
//   id: string | undefined;
//   /** The MoteId of the required quest */
//   quest: string | undefined;
//   status: Crashlands2.QuestStatus;
//   style: 'Quest';
// }

// export interface ParsedRequirementOther {
//   kind: 'other';
//   id: string | undefined;
//   style: string;
// }

// type ParsedMoment = ParsedEmoteGroup | ParsedDialog | ParsedOtherMoment;

// type ParsedRequirement = ParsedRequirementQuest | ParsedRequirementOther;

// export type QuestMomentsLabel = `quest_${'start' | 'end'}_moments`;
// export type QuestRequirementsLabel = `quest_${'start' | 'end'}_requirements`;

// export interface QuestUpdateResult
//   extends ParserResult<
//     {
//       /** The moteId for the storyline */
//       storyline?: string;
//       /** The moteId for the quest giver */
//       quest_giver?: string;
//       /** The moteId for the quest receiver */
//       quest_receiver?: string;
//       clues: ParsedClue[];
//       quest_start_log?: string;
//     } & {
//       [K in QuestMomentsLabel]: ParsedMoment[];
//     } & {
//       [K in QuestRequirementsLabel]: ParsedRequirement[];
//     }
//   > {}

// export type Section = (typeof sections)[number];
// export const sections = ['start moments', 'end moments'] as const;

// const moteTagPattern = '(?:@(?<moteTag>[a-z0-9_]+))';
// const moteNamePattern = "(?<moteName>[A-Za-z0-9:&?! ',()/-]+)";
// const emojiGroupPattern = '(?<emojiGroup>\\(\\s*(?<emojiName>[^)]*?)\\s*\\))';

// export const linePatterns = [
//   /** Label:Text */
//   `^(?<labelGroup>(?<label>Name|Log|Stage)\\s*:)\\s*(?<text>.*?)\\s*$`,
//   /** Labeled Mote */
//   `^(?<labelGroup>(?<label>[\\w ]+)${arrayTagPattern}?\\s*:)\\s*(${moteNamePattern}${moteTagPattern}?)?\\s*$`,
//   /** Dialogue Speaker */
//   `^(?<indicator>\\t)(${moteNamePattern}${moteTagPattern}?)?\\s*$`,
//   /** Dialogue Text */
//   `^(?<indicator>>)\\s*?${arrayTagPattern}?(\\s+${emojiGroupPattern}?(\\s*(?<text>.*)))?\\s*$`,
//   /** Comment Line */
//   `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
//   /** Emote Declaration */
//   `^(?<indicator>:\\))\\s*${arrayTagPattern}?\\s*$`,
//   /** Emote */
//   `^(?<indicator>!)\\s*?${arrayTagPattern}?(?<sep>\\s+)(${moteNamePattern}${moteTagPattern}\\s+${emojiGroupPattern})?\\s*$`,
//   /** Requirement: Quest */
//   // for e.g. `?#qpzc Quest Complete: Square Shaped@q_petget1_rc_c0_n5_2d`
//   `^(?<indicator>\\?)\\s*${arrayTagPattern}?\\s+(?<style>Quest)\\s+(?<status>Complete|Started|Not Started)\\s*:(?<sep>\\s+)(${moteNamePattern}${moteTagPattern}?)?$`,
//   /** Non-Dialog Moment */
//   `^(?<indicator>\\?)\\s*?${arrayTagPattern}?(?<sep>\\s+)(?<style>.*?)?\\s*$`,
// ];
