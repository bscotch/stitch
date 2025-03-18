import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import {
  CreditsData,
  CreditsMote,
  creditsSchemaId,
  ParserResult,
} from './cl2.shared.types.js';
import type { BschemaRoot } from './types.js';

export interface CreditsUpdateResult extends ParserResult<{}> {}

export function listCredits(gcData: Gcdata): [CreditsMote] {
  return gcData.listMotesBySchema<CreditsData>(creditsSchemaId) as [
    CreditsMote,
  ];
}

export function isCreditsMote(mote: any): mote is CreditsMote {
  return mote.schema_id === creditsSchemaId;
}

export function getCreditsMote(
  gcData: Gcdata,
  moteId: string,
): CreditsMote | undefined {
  const mote = gcData.getMote<CreditsData>(moteId);
  assert(!mote || isCreditsMote(mote), `Mote ${moteId} is not a storyline`);
  return mote;
}

export function getCreditsSchema(gcData: Gcdata): BschemaRoot | undefined {
  return gcData.getSchema(creditsSchemaId) as BschemaRoot;
}

export const linePatterns = [];
