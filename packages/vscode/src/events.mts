import { createEventEmitter } from '@bscotch/emitter';
import type { Asset, Code } from '@bscotch/gml-parser';

export namespace StitchEvents {
  export type All = [AssetDeleted, CodeFileDeleted];

  export interface AssetDeleted {
    name: 'asset-deleted';
    payload: [Asset];
  }
  export interface CodeFileDeleted {
    name: 'code-file-deleted';
    payload: [Code];
  }
  // export interface CodeFileCreated {
  //   name: 'code-file-created';
  //   payload: [Code];
  // }
  // export interface AssetCreated {
  //   name: 'asset-created';
  //   payload: [Asset];
  // }
  // export interface ParentSet {
  //   name: 'parent-set';
  //   payload: [child: Asset<'objects'>];
  // }
}

export const stitchEvents = createEventEmitter<StitchEvents.All>();
