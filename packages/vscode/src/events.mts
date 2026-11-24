import { createEventEmitter } from '@bscotch/emitter';
import type { Asset } from '@bscotch/gamemaker-project';
import type {
  InstalledRuntime,
  PreparedIgorCommand,
} from '@bscotch/stitch-launcher';
import type { StitchProject } from './extension.project.mjs';

export namespace StitchEvents {
  export type All = [
    SpriteEditorOpen,
    RunProjectStart,
    CleanProjectStart,
    OpenProjectStart,
    AssetChanged,
    ProjectChanged,
    DatafilesChanged,
    RequestRunInWebview,
    RequestStopInWebview,
  ];
  export interface RequestRunInWebview {
    name: 'request-run-project-in-webview';
    payload: [
      {
        command: PreparedIgorCommand;
        runtime: InstalledRuntime;
        project: StitchProject;
        clean?: boolean;
      },
    ];
  }
  export interface RequestStopInWebview {
    name: 'request-kill-project-in-webview';
    payload: [];
  }
  export interface DatafilesChanged {
    name: 'datafiles-changed';
    payload: [StitchProject];
  }
  export interface SpriteEditorOpen {
    name: 'sprite-editor-open';
    payload: [Asset<'sprites'>];
  }
  export interface RunProjectStart {
    name: 'run-project-start';
    payload: [StitchProject];
  }
  export interface CleanProjectStart {
    name: 'clean-project-start';
    payload: [StitchProject];
  }
  export interface OpenProjectStart {
    name: 'open-project-start';
    payload: [StitchProject];
  }
  /** An asset's yy data or files changed */
  export interface AssetChanged {
    name: 'asset-changed';
    payload: [asset: Asset];
  }
  /** Assets were added or removed, or the project's folders changed */
  export interface ProjectChanged {
    name: 'project-changed';
    payload: [project: StitchProject];
  }
}

export const stitchEvents = createEventEmitter<StitchEvents.All>();
