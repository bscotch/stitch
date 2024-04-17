import type { Range } from './types.editor.js';

export interface ParsedBase {
  name?: string;
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
