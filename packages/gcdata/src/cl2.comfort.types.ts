import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import {
  arrayTagPattern,
  ComfortData,
  ComfortMote,
  comfortSchemaId,
  ParserResult,
} from './cl2.shared.types.js';
import type { BschemaRoot } from './types.js';

export interface ComfortUpdateResult
  extends ParserResult<{
    description?: string;
    unlockedDescription?: string;
  }> {}

export function listComforts(gcData: Gcdata): ComfortMote[] {
  return gcData.listMotesBySchema<ComfortData>(comfortSchemaId);
}

export function isComfortMote(mote: any): mote is ComfortMote {
  return mote.schema_id === comfortSchemaId;
}

export function getComfortMote(
  gcData: Gcdata,
  moteId: string,
): ComfortMote | undefined {
  const mote = gcData.getMote<ComfortData>(moteId);
  assert(!mote || isComfortMote(mote), `Mote ${moteId} is not a storyline`);
  return mote;
}

export function getComfortSchema(gcData: Gcdata): BschemaRoot | undefined {
  return gcData.getSchema(comfortSchemaId) as BschemaRoot;
}

export const linePatterns = [
  /** Label:Text */
  `^(?<labelGroup>(?<label>Name|Description|Unlocked Description|Stage)\\s*:)\\s*(?<text>.*?)\\s*$`,
  /** Comment Line */
  `^(?<indicator>//)\\s*?${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
];
