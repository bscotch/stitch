import type { Range } from './types.editor.js';

export interface ParsedComment {
  /** arrayId */
  id: string | undefined;
  text: string | undefined;
}

export interface ParsedBase {
  name?: string;
  draft?: boolean;
  comments: ParsedComment[];
}

export type ParsedWord = Range & {
  value: string;
  suggestions?: string[];
  valid: boolean;
};
export interface ParserResult {
  diagnostics: (Range & { message: string })[];
  hovers: (Range & { title?: string; description?: string })[];
  edits: (Range & { newText: string })[];
  completions: Range[];
  words: ParsedWord[];
  parsed: ParsedBase;
}
