import { issueTypes } from './GameMakerIssue.constants.js';

export type GameMakerIssueType = keyof typeof issueTypes;

export interface GameMakerIssueForm {
  type: GameMakerIssueType;
  summary: string;
  description: string;
  platforms: string[];
  affected: string[];
}

export interface GameMakerIssueEnvironment {
  runtimeVersion: string;
  ideVersion: string;
  os: string;
}

export interface GameMakerIssueUpdateOptions {
  compilerConfig?: string;
  useYyc?: boolean;
  /**
   * Normally the updater will early-exit
   * if the `issue.yaml` file is invalid.
   */
  skipTemplateValidation?: boolean;
}
