import { createEventEmitter } from '@bscotch/emitter';
import type vscode from 'vscode';
import type { ParsedGameChangerUri } from './quests.util.mjs';

export namespace CrashlandsEvents {
  export type All = [MoteOpened, MoteUpdated, MoteNameChanged];
  export interface MoteUpdated {
    name: 'mote-updated';
    payload: [vscode.Uri];
  }
  export interface MoteOpened {
    name: 'mote-opened';
    payload: [uri: vscode.Uri, parsedUri: ParsedGameChangerUri];
  }
  export interface MoteNameChanged {
    name: 'mote-name-changed';
    payload: [
      {
        file: vscode.Uri;
        schemaId: string;
        moteId: string;
        newName: string | undefined;
        oldName: string | undefined;
      },
    ];
  }
}

export const crashlandsEvents = createEventEmitter<CrashlandsEvents.All>();
