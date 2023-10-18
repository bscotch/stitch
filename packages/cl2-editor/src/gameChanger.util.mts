import { Crashlands2, Mote, Packed, questMoteToText } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';

export function questToBuffer(mote: Mote<Crashlands2.Quest>, packed: Packed) {
  const asText = questMoteToText(mote, packed);
  return new Uint8Array(Buffer.from(asText, 'utf-8'));
}

export function moteToPath(mote: Mote) {
  return `bschema:///schemas/${mote.schema_id}/motes/${mote.id}.${mote.schema_id}`;
}

export interface ParsedGameChangerUri {
  schemaId?: string;
  moteId?: string;
  name?: string;
  ext?: string;
}

export function parseGameChangerUri(
  uri: vscode.Uri | string,
): ParsedGameChangerUri {
  if (typeof uri === 'string') {
    uri = vscode.Uri.parse(uri);
  }
  assertInternalClaim(uri.scheme === 'bschema', 'Expected a bschema uri');
  const match = uri.path.match(
    /\/schemas\/(?<schemaId>[^/]+)(\/motes(\/(?<moteId>[^/]+)\.(?<ext>[a-z0-9_-]+)?))?$/,
  )?.groups;
  assertInternalClaim(match, `Invalid mote URI: "${uri.toString()}"`);
  return match as ParsedGameChangerUri;
}
