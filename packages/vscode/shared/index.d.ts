export interface IgorWebviewLog {
  kind: 'out' | 'err';
  message: string;
}
export interface IgorWebviewExtensionPostRun {
  kind: 'run';
  runtimeVersion: string;
  cmd: string;
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

export type IgorWebviewExtensionPosts =
  | WebviewReadyMessage
  | IgorWebviewExtensionPostRun
  | IgorWebviewExtensionPostLogs;
export type IgorWebviewPosts = WebviewReadyMessage;
