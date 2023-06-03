import type { IRecognitionException, IToken } from 'chevrotain';
import type { Range } from './project.location.js';

export type GmlParseError = IRecognitionException & { previousToken?: IToken };
export interface Diagnostic {
  $tag: 'diagnostic';
  kind: 'parser';
  message: string;
  severity: 'error' | 'warning' | 'info';
  location: Range;
  info?: GmlParseError;
}
