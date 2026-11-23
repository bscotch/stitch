export type SyntaxDiagnosticCode =
  | 'unexpected-character'
  | 'unterminated-string'
  | 'unterminated-template'
  | 'unterminated-comment'
  | 'unexpected-token'
  | 'expected-token'
  | 'expected-expression'
  | 'expected-identifier'
  | 'invalid-assignment-target';

export interface SyntaxDiagnostic {
  code: SyntaxDiagnosticCode;
  message: string;
  severity: 'error' | 'warning';
  /** Offset of the first character the diagnostic applies to */
  start: number;
  /** Offset just past the last character the diagnostic applies to */
  end: number;
}
