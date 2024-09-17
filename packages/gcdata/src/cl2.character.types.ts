import type { Gcdata } from './GameChanger.js';
import {
  arrayTagPattern,
  buddySchemaId,
  commentLinePattern,
  dialogPattern,
  npcSchemaId,
  type BuddyData,
  type BuddyMote,
  type NpcData,
  type NpcMote,
  type ParserResult,
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

export interface CharacterUpdateResult
  extends ParserResult<{
    idles: ParsedTopic[];
  }> {}

export interface ParsedTopic {
  id: string | undefined;
  name: string | undefined;
  groups: ParsedGroup[];
}

export interface ParsedGroup {
  id: string | undefined;
  name: string | undefined;
  phrases: {
    /** arrayId */
    id: string | undefined;
    /** MoteId for the Emoji */
    emoji?: string;
    text: string | undefined;
  }[];
}

export const linePatterns = [
  // Label: Text
  `^(?<labelGroup>(?<label>Name|Stage|Idle Dialogue)\\s*:)\\s*(?<text>.*?)\\s*$`,
  // Topics (Topic#xxxx: The Topic!)
  `^(?<labelGroup>(?<label>Topic)${arrayTagPattern}?\\s*:)\\s*(?<text>.*?)\\s*$`,
  // Phrase Group Names
  `^(?<indicator>\\t)(?:${arrayTagPattern}\\s+)?(?<text>.*?)\\s*$`,
  dialogPattern,
  commentLinePattern,
];
