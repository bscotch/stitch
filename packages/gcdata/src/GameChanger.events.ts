import { createEventEmitter } from '@bscotch/emitter';
import { Mote } from './types.js';

export namespace GameChangerEvents {
  export type All = [GameChangerWorkingUpdated, GameChangerChangesSaved];
  export interface GameChangerWorkingUpdated {
    name: 'gamechanger-working-updated';
    payload: [Mote];
  }
  export interface GameChangerChangesSaved {
    name: 'gamechanger-changes-saved';
  }
}

export const gameChangerEvents = createEventEmitter<GameChangerEvents.All>();
