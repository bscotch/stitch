import { createEventEmitter } from '@bscotch/emitter';
import type { Asset, Code } from '@bscotch/gml-parser';
import type { GameMakerProject } from './extension.project.mjs';

export namespace StitchEvents {
  export type All = [
    AssetDeleted,
    CodeFileDeleted,
    RunProjectStart,
    CleanProjectStart,
    OpenProjectStart,
  ];

  export interface AssetDeleted {
    name: 'asset-deleted';
    payload: [Asset];
  }
  export interface CodeFileDeleted {
    name: 'code-file-deleted';
    payload: [Code];
  }
  export interface RunProjectStart {
    name: 'run-project-start';
    payload: [GameMakerProject];
  }
  export interface CleanProjectStart {
    name: 'clean-project-start';
    payload: [GameMakerProject];
  }
  export interface OpenProjectStart {
    name: 'open-project-start';
    payload: [GameMakerProject];
  }
}

export const stitchEvents = createEventEmitter<StitchEvents.All>();
