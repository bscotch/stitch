import { createEventEmitter } from '@bscotch/emitter';
import type { Asset, Code } from '@bscotch/gml-parser';
import type { GameMakerRuntime } from '@bscotch/stitch-launcher';
import type vscode from 'vscode';
import type { GameMakerProject } from './extension.project.mjs';

export namespace StitchEvents {
  export type All = [
    AssetDeleted,
    CodeFileDeleted,
    SpriteEditorOpen,
    RunProjectStart,
    CleanProjectStart,
    OpenProjectStart,
    AssetChanged,
    ProjectChanged,
    DatafilesChanged,
    RequestRunInWebview,
  ];
  export interface RequestRunInWebview {
    name: 'request-run-project-in-webview';
    payload: [
      {
        cmd: string;
        args: string[];
        runtime: GameMakerRuntime;
        project: GameMakerProject;
        clean?: boolean;
      },
    ];
  }
  export interface DatafilesChanged {
    name: 'datafiles-changed';
    payload: [GameMakerProject];
  }
  export interface AssetDeleted {
    name: 'asset-deleted';
    payload: [Asset];
  }
  export interface CodeFileDeleted {
    name: 'code-file-deleted';
    payload: [Code];
  }
  export interface SpriteEditorOpen {
    name: 'sprite-editor-open';
    payload: [Asset<'sprites'>];
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
  export interface AssetChanged {
    name: 'asset-changed';
    payload: [
      sprite: Asset,
      type: 'change' | 'create' | 'delete',
      path: vscode.Uri,
    ];
  }
  export interface ProjectChanged {
    name: 'project-changed';
    payload: [project: GameMakerProject];
  }
}

export const stitchEvents = createEventEmitter<StitchEvents.All>();
