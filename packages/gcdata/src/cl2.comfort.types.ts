import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import { arrayTagPattern, ParserResult } from './cl2.shared.types.js';
import type { Crashlands2 } from './cl2.types.auto.js';
import type { BschemaRoot, Mote } from './types.js';

export const comfortSchemaId = 'cl2_artisan_glads';

export type ComfortData = Crashlands2.Schemas['cl2_artisan_glads'];
export type ComfortMote = Mote<ComfortData>;

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
