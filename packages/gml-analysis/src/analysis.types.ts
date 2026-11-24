/**
 * Data types produced by checking a file.
 */
import type {
  FunctionEntry,
  ShapeEntry,
  ShapeId,
  SymbolEntry,
  SymbolId,
  SymbolKind,
  FunctionId,
} from './symbols.ts';
import type { Type, TypeUnion } from './types.ts';

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export type DiagnosticCode =
  | 'syntax'
  | 'jsdoc'
  | 'jsdoc-mismatch'
  | 'global-self'
  | 'invalid-operation'
  | 'undeclared-global'
  | 'undeclared-variable'
  | 'missing-argument'
  | 'too-many-arguments'
  | 'unused-function'
  | 'shadowed-native'
  | 'mixed-operators'
  | 'argument-evaluation-order'
  | 'broken-link'
  | 'unknown-type';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  start: number;
  end: number;
}

/** A reference to a symbol from a file */
export interface Reference {
  start: number;
  end: number;
  /** The referenced symbol, or (if `implicit`) the symbol it would be if it were declared */
  symbol: SymbolId;
  /** The name wasn't found anywhere: this is an undeclared variable */
  implicit?: boolean;
  /** The reference assigns to the symbol */
  write?: boolean;
  /**
   * `self` or `other`: refers to the symbol, but not by name (so it's left
   * alone when the symbol is renamed)
   */
  keyword?: boolean;
}

/** A region of a file with a specific local and `self` scope, for completions */
export interface ScopeRange {
  start: number;
  end: number;
  local: ShapeId;
  /** The self scope (`undefined` when it's the global scope) */
  self?: ShapeId;
  selfType: Type;
  /** Right after a `.`: only members of `self` make sense */
  dot?: boolean;
}

/** The argument region of a function call, for signature help */
export interface ArgumentRange {
  start: number;
  end: number;
  fn: FunctionId;
  idx: number;
  hasExpression: boolean;
}

export interface CallInfo {
  fn: FunctionId;
  start: number;
  end: number;
  args: ArgumentRange[];
  /** The number of arguments written (including omitted ones, as in `f(a,,c)`) */
  argCount: number;
}

/** A place inside a struct literal where a new member could be added */
export interface StructMemberRange {
  start: number;
  end: number;
  shape: ShapeId;
}

/**
 * A member that a file declares (or assigns to) in some shape. Where many
 * files contribute the same member, the most definitive one becomes its
 * declaration.
 */
export interface MemberContribution {
  shape: ShapeId;
  name: string;
  file: string;
  start: number;
  end: number;
  /**
   * Lower is more definitive:
   * 0. declarations (globals, Create events, constructors, struct literals, docs)
   * 1. other code belonging to the same object/constructor
   * 2. assignments from elsewhere
   * 3. reads of `global.x` that is never assigned
   */
  priority: number;
  kind: SymbolKind;
  declaredType?: TypeUnion;
  inferredType?: TypeUnion;
  description?: string;
  fn?: FunctionId;
  /** For symbols that name a shape (enums, constructors) */
  shapeRef?: ShapeId;
  /** Make this member point to an existing symbol instead (mixins) */
  alias?: SymbolId;
  static?: boolean;
  instance?: boolean;
  deprecated?: boolean;
  mixin?: boolean;
  writable?: boolean;
  idx?: number;
}

/** Entities a file defines that nothing else contributes to */
export interface OwnedEntities {
  shapes: ShapeEntry[];
  functions: FunctionEntry[];
  /** Locals, parameters, and other symbols private to the file */
  symbols: SymbolEntry[];
}

/** What a file's check depended on, for incremental re-checking */
export interface FileDependencies {
  /** `shape` → names looked up in it (`*` for "all members") */
  members: Map<ShapeId, Set<string>>;
  symbols: Set<SymbolId>;
  functions: Set<FunctionId>;
}

export interface FileAnalysis {
  file: string;
  /** The text hash this analysis is for */
  hash: string;
  refs: Reference[];
  scopes: ScopeRange[];
  argumentRanges: ArgumentRange[];
  calls: CallInfo[];
  structMemberRanges: StructMemberRange[];
  diagnostics: Diagnostic[];
  members: MemberContribution[];
  owned: OwnedEntities;
  deps: FileDependencies;
  /** Whether the file calls `event_inherited()` */
  callsInherited: boolean;
}
