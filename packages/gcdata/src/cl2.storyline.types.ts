import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import {
  arrayTagPattern,
  ParserResult,
  StorylineData,
  StorylineMote,
  storylineSchemaId,
} from './cl2.shared.types.js';
import type { BschemaRoot } from './types.js';

export interface StorylineUpdateResult
  extends ParserResult<{
    description?: string;
  }> {}

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

export function getStorylineSchema(gcData: Gcdata): BschemaRoot | undefined {
  return gcData.getSchema(storylineSchemaId) as BschemaRoot;
}

export const linePatterns = [
  /** Label:Text */
  `^(?<labelGroup>(?<label>Name|Description|Stage)\\s*:)\\s*(?<text>.*?)\\s*$`,
  /** Comment Line */
  `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
];
