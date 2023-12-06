import { createEventEmitter } from '@bscotch/emitter';
import type vscode from 'vscode';
import type { ParsedGameChangerUri } from './quests.util.mjs';

export namespace CrashlandsEvents {
  export type All = [
    QuestUpdated,
    QuestOpened,
    StorylineUpdated,
    MoteNameChanged,
  ];
  export interface QuestUpdated {
    name: 'quest-updated';
    payload: [vscode.Uri];
  }
  export interface StorylineUpdated {
    name: 'storyline-updated';
    payload: [vscode.Uri];
  }
  export interface QuestOpened {
    name: 'quest-opened';
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
