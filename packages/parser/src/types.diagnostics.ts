import type { IRecognitionException } from 'chevrotain';

export type GmlParseError = IRecognitionException;
export interface Diagnostic {
  type: 'diagnostic';
  kind: 'parser';
  message: string;
  severity: 'error' | 'warning' | 'info';
  location: {
    file: string;
    startColumn: number;
    endColumn: number;
    startLine: number;
    endLine: number;
    startOffset: number;
    endOffset: number;
  };
  info?: GmlParseError;
}
