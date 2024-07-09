import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import { arrayTagPattern } from './cl2.shared.types.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import type { ParsedBase, ParserResult } from './cl2.types.editor.js';
import type { Range } from './types.editor.js';
import type { BschemaRoot, Mote } from './types.js';

export const storylineSchemaId = 'cl2_storyline';

export type StorylineData = Crashlands2.Schemas['cl2_storyline'];
export type StorylineMote = Mote<StorylineData>;

type CompletionsData =
  | { type: 'glossary'; options: string[] }
  | { type: 'stages'; options: string[] }
  | { type: 'labels'; options: Set<string> };
export interface StorylineUpdateResult extends ParserResult {
  parsed: ParsedBase & {
    description?: string;
  };
  completions: (Range & CompletionsData)[];
}

export function listStorylines(gcData: Gcdata): StorylineMote[] {
  return gcData.listMotesBySchema<StorylineData>(storylineSchemaId);
}

export function isStorylineMote(mote: any): mote is StorylineMote {
  return mote.schema_id === storylineSchemaId;
}

export function getStorylineMote(
  gcData: Gcdata,
  moteId: string,
): StorylineMote | undefined {
  const mote = gcData.getMote<StorylineData>(moteId);
  assert(!mote || isStorylineMote(mote), `Mote ${moteId} is not a storyline`);
  return mote;
}

export function getStorylineMotes(gcData: Gcdata): StorylineMote[] {
  const motes = gcData.listMotesBySchema<StorylineData>(storylineSchemaId);
  return motes;
}

export function getStorylineSchema(gcData: Gcdata): BschemaRoot | undefined {
  return gcData.getSchema(storylineSchemaId) as BschemaRoot;
}

export const linePatterns = [
  /** Label:Text */
  `^(?<labelGroup>(?<label>Name|Description|Stage)\\s*:)\\s*(?<text>.*?)\\s*$`,
  /** Comment Line */
  `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
];
