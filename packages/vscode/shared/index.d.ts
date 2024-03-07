import type { GameConsoleStyle } from '@bscotch/stitch-config';

export interface IgorWebviewLog {
  kind: 'stdout' | 'stderr';
  message: string;
}

export interface IgorWebviewConfig extends GameConsoleStyle {
  fontFamily: string | null;
  fontSize: number;
}

export interface IgorWebviewExtensionPostRun {
  kind: 'run';
  runtimeVersion: string;
  cmd: string;
  args: string[];
  projectName: string;
  /** Absolute path to this project's folder on disk */
  projectDir: string;
  cleaning?: boolean;
  config?: IgorWebviewConfig;
}
export interface IgorWebviewExtensionPostConfig {
  kind: 'config';
  config: IgorWebviewConfig;
}
export interface IgorWebviewExtensionPostLogs {
  kind: 'log';
  logs: IgorWebviewLog[];
}
export interface WebviewReadyMessage {
  kind: 'ready';
}
export interface WebviewResetMessage {
  kind: 'reset';
}
export interface IgorExitedMessage {
  kind: 'exited';
  code: number | null;
}
export interface ToggleSearchMessage {
  kind: 'toggle-search';
}

export type IgorWebviewExtensionPosts =
  | WebviewResetMessage
  | IgorExitedMessage
  | IgorWebviewExtensionPostConfig
  | WebviewReadyMessage
  | IgorWebviewExtensionPostRun
  | IgorWebviewExtensionPostLogs
  | ToggleSearchMessage;
export type IgorWebviewPosts = WebviewReadyMessage;
