import type { Gcdata } from './GameChanger.js';
import { assert } from './assert.js';
import {
  arrayTagPattern,
  commentLinePattern,
  CreditsData,
  CreditsMote,
  creditsSchemaId,
  ParserResult,
} from './cl2.shared.types.js';
import type { BschemaRoot } from './types.js';

export interface CreditsUpdateResult
  extends ParserResult<{
    sections: CreditsUpdateResultSection[];
  }> {}

export interface CreditsUpdateResultSection {
  id: string;
  title: string;
  roles: CreditsUpdateResultRole[];
}

export interface CreditsUpdateResultRole {
  type: 'role';
  id: string;
  role?: string;
  names: {
    /** ID added when converting to Mote data */
    id?: string;
    name: string;
    cjk?: boolean;
  }[];
}

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

export const linePatterns = [
  // Gap Line (===)
  `^(?<indicator>===)\\s*$`,
  // Name Line (\t- <name>)
  `^(?<indicator>\\t-\\s*)(?<text>.*?)\\s*$`,
  // Role Line (\t#<roleId> <roleName>)
  `^(?<indicator>\\t)${arrayTagPattern}?\\s*(?<text>.*?)\\s*$`,
  // Section Line (#<sectionId> <sectionName>)
  `^(${arrayTagPattern}\\s+)?(?<text>[^\t]+)$`,
  commentLinePattern,
];
