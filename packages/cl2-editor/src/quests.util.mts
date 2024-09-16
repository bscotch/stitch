import {
  buddySchemaId,
  comfortSchemaId,
  npcSchemaId,
  questSchemaId,
  storylineSchemaId,
  type Mote,
  type Range,
} from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';

export function moteToPath(mote: Mote): string {
  return `bschema:///schemas/${mote.schema_id}/motes/${mote.id}.${mote.schema_id}`;
}

export function moteToUri(mote: Mote): vscode.Uri {
  return vscode.Uri.parse(moteToPath(mote));
}

export function hasEditor(mote: Mote): boolean {
  return [
    questSchemaId,
    storylineSchemaId,
    comfortSchemaId,
    buddySchemaId,
    npcSchemaId,
  ].includes(mote.schema_id);
}

export function isQuestUri(uri: vscode.Uri) {
  return uri.scheme === 'bschema' && uri.path.endsWith(`.${questSchemaId}`);
}

export function isStorylineUri(uri: vscode.Uri) {
  return uri.scheme === 'bschema' && uri.path.endsWith(`.${storylineSchemaId}`);
}

export function isComfortUri(uri: vscode.Uri) {
  return uri.scheme === 'bschema' && uri.path.endsWith(`.${comfortSchemaId}`);
}

export function isBuddyUri(uri: vscode.Uri) {
  return uri.scheme === 'bschema' && uri.path.endsWith(`.${buddySchemaId}`);
}

export function isNpcUri(uri: vscode.Uri) {
  return uri.scheme === 'bschema' && uri.path.endsWith(`.${npcSchemaId}`);
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

export function range(raw: Range): vscode.Range {
  return new vscode.Range(
    new vscode.Position(raw.start.line, raw.start.character),
    new vscode.Position(raw.end.line, raw.end.character),
  );
}

export function filterRanges<R extends Range>(
  ranges: R[],
  by: { includesPosition: vscode.Position },
): R[] {
  return ranges.filter((r) => {
    if (by.includesPosition) {
      return (
        r.start.line <= by.includesPosition.line &&
        r.start.character <= by.includesPosition.character &&
        r.end.line >= by.includesPosition.line &&
        r.end.character >= by.includesPosition.character
      );
    }
    return true;
  });
}

export function getCursorPosition() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }
  const position = activeEditor.selection.active;
  return position;
}
