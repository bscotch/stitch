import type { Gcdata } from './GameChanger.js';
import {
  arrayTagPattern,
  ChatData,
  ChatMote,
  chatSchemaId,
  commentLinePattern,
  dialogPattern,
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

export interface ChatUpdateResult extends ParserResult<{}> {}

export const linePatterns = [
  // Label: Text
  `^(?<labelGroup>(?<label>Name|Stage|Idle Dialogue)\\s*:)\\s*(?<text>.*?)\\s*$`,
  // Topics (Topic#xxxx: The Topic!)
  `^(?<label>Topic)${arrayTagPattern}?(?:\\s*(?<sep>:)\\s*(?<text>.*?)\\s*)?$`,
  // Phrase Group Names
  `^(?<indicator>\\t)(?:${arrayTagPattern}(?<sep>\\s+))?(?<text>.*?)\\s*$`,
  dialogPattern,
  commentLinePattern,
];
