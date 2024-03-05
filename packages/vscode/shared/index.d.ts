export interface IgorWebviewLog {
  kind: 'stdout' | 'stderr';
  message: string;
}
export interface IgorWebviewExtensionPostRun {
  kind: 'run';
  runtimeVersion: string;
  cmd: string;
  args: string[];
  projectName: string;
  cleaning?: boolean;
  config?: {
    fontFamily: string | null;
    fontSize: number;
  };
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
  | WebviewReadyMessage
  | IgorWebviewExtensionPostRun
  | IgorWebviewExtensionPostLogs
  | ToggleSearchMessage;
export type IgorWebviewPosts = WebviewReadyMessage;
