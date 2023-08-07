import type { CstNodeLocation } from 'chevrotain';
import type { Docs } from './parser.js';
import type { Code } from './project.code.js';
import {
  Diagnostic,
  DiagnosticCollectionName,
  DiagnosticSeverity,
} from './project.diagnostics.js';
import {
  Position,
  Range,
  type IRange,
  type Scope,
} from './project.location.js';
import { Type, WithableType, type EnumType, type StructType } from './types.js';
import { assert } from './util.js';

export const diagnosticCollections = [
  'GLOBAL_SELF',
  'UNDECLARED_GLOBAL_REFERENCE',
  'INVALID_OPERATION',
  'JSDOC_MISMATCH',
] satisfies DiagnosticCollectionName[];

export class SignifierProcessor {
  protected readonly localScopeStack: StructType[] = [];
  protected readonly selfStack: (WithableType | EnumType)[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  public scope: Scope;
  readonly position: Position;
  public unusedJsdoc: Docs | undefined;
  /**
   * For the current node, the "definitive" self. This is the
   * self that is used definitionally, e.g. a constructor's self
   * or a Create event's self. This is only set when we are inside
   * a "definitive" location for the self, so that we can use this
   * value to determine if currentSelf is also the definitiveSelf,
   * or if we are accessing that self externally to where it is defined.
   */
  protected readonly definitiveSelfStack: (StructType | undefined)[] = [];

  constructor(readonly file: Code) {
    this.scope = file.scopes[0];
    assert(
      this.scope,
      'SymbolProcessor constructor: File must have a global scope',
    );
    this.localScopeStack.push(this.scope.local);
    this.selfStack.push(this.scope.self);
    this.position = this.scope.start;
    this.definitiveSelfStack.push(this.file.definitiveSelf);
  }

  consumeJsdoc() {
    const docs = this.unusedJsdoc;
    this.unusedJsdoc = undefined;
    return docs;
  }

  /**
   * If a single node is provided, create a range from it.
   * If two are provided, use the start of the first and end
   * of the second to create the range.
   */
  range(loc: CstNodeLocation, endLoc?: CstNodeLocation) {
    const start = this.position.at(loc);
    const end = this.position.atEnd(endLoc || loc);
    return new Range(start, end);
  }

  addDiagnostic(
    kind: (typeof diagnosticCollections)[number],
    where: IRange | CstNodeLocation,
    message: string,
    severity: DiagnosticSeverity = 'warning',
  ) {
    this.file.addDiagnostic(
      kind,
      new Diagnostic(message, Range.from(this.file, where), severity),
    );
  }

  get fullScope() {
    return {
      local: this.currentLocalScope,
      self: this.currentSelf,
      definitiveSelf: this.currentDefinitiveSelf,
      global: this.project.self,
      selfIsGlobal: this.currentSelf === this.project.self,
    };
  }

  get asset() {
    return this.file.asset;
  }

  get project() {
    return this.asset.project;
  }

  get globalSelf() {
    return this.project.self;
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  get currentSelf() {
    return this.selfStack.at(-1) || this.project.self;
  }

  get currentDefinitiveSelf() {
    return this.definitiveSelfStack.at(-1);
  }

  get outerSelf() {
    return this.selfStack.at(-2) || this.project.self;
  }

  protected nextScope(token: CstNodeLocation, fromTokenEnd: boolean) {
    this.scope = this.scope.createNext(token, fromTokenEnd);
    this.file.scopes.push(this.scope);
    return this.scope;
  }

  /**
   * After parsing the entire file, the last scope might not
   * have an appropriate end position. Set it here!
   */
  setLastScopeEnd(rootNode: CstNodeLocation) {
    const lastScope = this.file.scopes.at(-1)!;
    lastScope.end = this.scope.end.atEnd(rootNode);
    if (lastScope.end.offset < lastScope.start.offset) {
      lastScope.end = lastScope.start;
    }
  }

  createStruct(token: CstNodeLocation, endToken?: CstNodeLocation) {
    return new Type('Struct');
  }

  pushScope(
    startToken: CstNodeLocation,
    self: WithableType | EnumType,
    localScope: StructType,
    fromTokenEnd: boolean,
  ) {
    this.localScopeStack.push(localScope);
    this.selfStack.push(self);
    this.nextScope(startToken, fromTokenEnd);
    this.scope.self = self;
    this.scope.local = localScope;
  }

  popScope(
    nextScopeToken: CstNodeLocation,
    nextScopeStartsFromTokenEnd: boolean,
  ) {
    this.localScopeStack.pop();
    this.selfStack.pop();
    this.nextScope(nextScopeToken, nextScopeStartsFromTokenEnd).local =
      this.currentLocalScope;
    this.scope.self = this.currentSelf;
  }

  pushLocalScope(
    startToken: CstNodeLocation,
    fromTokenEnd: boolean,
    localScope = this.createStruct(startToken),
  ) {
    this.localScopeStack.push(localScope);
    this.nextScope(startToken, fromTokenEnd).local = localScope;
  }

  pushSelfScope(
    startToken: CstNodeLocation,
    self: EnumType | WithableType,
    fromTokenEnd: boolean,
    options?: { accessorScope?: boolean },
  ) {
    this.selfStack.push(self);
    const nextScope = this.nextScope(startToken, fromTokenEnd);
    nextScope.self = self;
    if (options?.accessorScope) {
      nextScope.isDotAccessor = true;
    }
  }

  popLocalScope(
    nextScopeToken: CstNodeLocation,
    nextScopeStartsFromTokenEnd: boolean,
  ) {
    this.localScopeStack.pop();
    this.nextScope(nextScopeToken, nextScopeStartsFromTokenEnd).local =
      this.currentLocalScope;
  }

  popSelfScope(
    nextScopeToken: CstNodeLocation,
    nextScopeStartsFromTokenEnd: boolean,
  ) {
    this.selfStack.pop();
    this.nextScope(nextScopeToken, nextScopeStartsFromTokenEnd).self =
      this.currentSelf;
  }

  pushDefinitiveSelf(self: StructType | undefined) {
    this.definitiveSelfStack.push(self);
  }

  popDefinitiveSelf() {
    this.definitiveSelfStack.pop();
  }
}
