import { createEventEmitter } from '@bscotch/emitter';
import type vscode from 'vscode';

export namespace CrashlandsEvents {
  export type All = [QuestUpdated];
  export interface QuestUpdated {
    name: 'quest-updated';
    payload: [vscode.Uri];
  }
}

export const crashlandsEvents = createEventEmitter<CrashlandsEvents.All>();
