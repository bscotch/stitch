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

export type IgorWebviewExtensionPosts =
  | WebviewResetMessage
  | IgorExitedMessage
  | WebviewReadyMessage
  | IgorWebviewExtensionPostRun
  | IgorWebviewExtensionPostLogs;
export type IgorWebviewPosts = WebviewReadyMessage;
