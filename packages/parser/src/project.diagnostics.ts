import type { IRecognitionException, IToken } from 'chevrotain';
import type { Range } from './project.location.js';

export type GmlParseError = IRecognitionException & { previousToken?: IToken };
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticCollections {
  GLOBAl_SELF: Diagnostic[];
  INVALID_OPERATION: Diagnostic[];
  JSDOC_MISMATCH: Diagnostic[];
  MISSING_EVENT_INHERITED: Diagnostic[];
  MISSING_REQUIRED_ARGUMENT: Diagnostic[];
  SYNTAX_ERROR: Diagnostic[];
  TOO_MANY_ARGUMENTS: Diagnostic[];
  UNDECLARED_VARIABLE_REFERENCE: Diagnostic[];
  UNDECLARED_GLOBAL_REFERENCE: Diagnostic[];
}
export type DiagnosticCollectionName = keyof DiagnosticCollections;

export class Diagnostic {
  readonly $tag = 'diagnostic';

  constructor(
    readonly message: string,
    readonly location: Range,
    readonly severity: DiagnosticSeverity = 'warning',
    readonly payload?: any,
  ) {}

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
