import { Crashlands2, Mote, Packed, bsArrayToArray } from '@bscotch/gcdata';
import vscode from 'vscode';
import { assertInternalClaim } from './assert.mjs';

export function questToBuffer(mote: Mote<Crashlands2.Quest>, packed: Packed) {
  const storyline = packed.getMote(mote.data.storyline);

  const blocks: string[] = [
    `NAME: ${packed.getMoteName(mote)}`,
    `STORYLINE: ${packed.getMoteName(storyline)} [${storyline.id}]`,
  ];

  if (mote.data.wip?.draft) {
    blocks.push(`DRAFT: true`);
  }

  if (mote.data.wip?.comments) {
    for (const comment of bsArrayToArray(mote.data.wip.comments)) {
      blocks.push(`// ${comment.element} [${comment.id}]`);
    }
  }

  if (mote.data.clues) {
    for (const clue of bsArrayToArray(mote.data.clues)) {
      if (!clue.element?.phrases || !clue.element.speaker) continue;
      const speaker = packed.getMote(clue.element.speaker);
      let clueString = `CLUE [${clue.id}]: ${packed.getMoteName(speaker)} [${
        clue.element.speaker
      }]`;
      for (const phraseContainer of bsArrayToArray(clue.element!.phrases)) {
        let line = '\n';
        const emoji = phraseContainer.element?.phrase.emoji;
        if (emoji) {
          line += `(${emoji}) `;
        }
        line += phraseContainer.element?.phrase.text.text || '';
        line += ` [${phraseContainer.id}]`;
        clueString += line;
      }
      blocks.push(clueString);
    }
  }

  return new Uint8Array(Buffer.from(blocks.join('\n\n') + '\n', 'utf-8'));
}

export function isQuestMote(mote: any): mote is Mote<Crashlands2.Quest> {
  return mote.schema_id === 'cl2_quest';
}

export function isStorylineMote(
  mote: any,
): mote is Mote<Crashlands2.Storyline> {
  return mote.schema_id === 'cl2_storyline';
}

export function moteToPath(mote: Mote, packed: Packed) {
  return `bschema:///schemas/${mote.schema_id}/motes/${mote.id}/${packed
    .getMoteName(mote)
    .replace(/ /g, '%20')}.${mote.schema_id}`;
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
    /\/schemas\/(?<schemaId>[^/]+)(\/motes(\/(?<moteId>[^/]+)\/(?<name>.*)\.(?<ext>[a-z0-9_-]+)?))?$/,
  )?.groups;
  assertInternalClaim(match, `Invalid mote URI: "${uri.toString()}"`);
  return match as ParsedGameChangerUri;
}
