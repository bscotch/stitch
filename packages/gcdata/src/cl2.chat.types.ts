import type { Gcdata } from './GameChanger.js';
import {
  arrayTagPattern,
  ChatData,
  ChatMote,
  chatSchemaId,
  commentLinePattern,
  emojiGroupPattern,
  moteNamePattern,
  moteTagPattern,
  type NpcData,
  type ParserResult,
} from './cl2.shared.types.js';
import type { Mote } from './types.js';

export function listChats(gcData: Gcdata): ChatMote[] {
  return gcData.listMotesBySchema<ChatData>(chatSchemaId);
}

export function isChatMote(mote: any): mote is Mote<NpcData> {
  return mote.schema_id === chatSchemaId;
}

export interface ChatUpdateResult
  extends ParserResult<{
    moments: ParsedMoment[];
  }> {}

export interface ParsedMoment {
  id: string | undefined;
  phrases: ParsedPhrase[];
}

export interface ParsedPhrase {
  id: string | undefined;
  speaker: string | undefined;
  /** MoteId for the Emoji */
  emoji?: string;
  text?: string;
}

// 	#rt10#kqbq RONXX@brubus_northwatch3
// > Should we open a gym?

export const linePatterns = [
  // Label: Text
  `^(?<labelGroup>(?<label>Name|Stage|Moments)\\s*:)\\s*(?<text>.*?)\\s*$`,
  // Moment heading
  `^(?<indicator>\\t)(?:${arrayTagPattern}?(?:#(?<arrayTag2>[a-z0-9]+))?(?<sep>\\s+)(${moteNamePattern}${moteTagPattern}?)?\\s*)?$`,
  // Dialog line
  `^(?<indicator>>)(?:\\s+${emojiGroupPattern}?(\\s*(?<text>.*)))?\\s*$`,
  commentLinePattern,
];
