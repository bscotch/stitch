import type { IRecognitionException, IToken } from 'chevrotain';
import type { IRange, Range } from './project.location.ts';

export type GmlParseError = IRecognitionException & { previousToken?: IToken };
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticCollections {
  GLOBAL_SELF: Diagnostic[];
  INVALID_OPERATION: Diagnostic[];
  JSDOC_MISMATCH: Diagnostic[];
  MISSING_EVENT_INHERITED: Diagnostic[];
  MISSING_REQUIRED_ARGUMENT: Diagnostic[];
  SYNTAX_ERROR: Diagnostic[];
  TOO_MANY_ARGUMENTS: Diagnostic[];
  UNDECLARED_VARIABLE_REFERENCE: Diagnostic[];
  UNDECLARED_GLOBAL_REFERENCE: Diagnostic[];
  JSDOC: Diagnostic[];
  UNUSED: Diagnostic[];
}
export type DiagnosticCollectionName = keyof DiagnosticCollections;

export class Diagnostic {
  readonly $tag = 'diagnostic';

  readonly message: string;
  readonly location: IRange;
  readonly severity: DiagnosticSeverity;
  readonly payload?: any;

  constructor(
    message: string,
    location: IRange,
    severity: DiagnosticSeverity = 'warning',
    payload?: any,
  ) {
    this.message = message;
    this.location = location;
    this.severity = severity;
    this.payload = payload;
  }

  static warn(message: string, location: Range, payload?: any) {
    return new Diagnostic(message, location, 'warning', payload);
  }

  static error(message: string, location: Range, payload?: any) {
    return new Diagnostic(message, location, 'error', payload);
  }

  static info(message: string, location: Range, payload?: any) {
    return new Diagnostic(message, location, 'info', payload);
  }
}
