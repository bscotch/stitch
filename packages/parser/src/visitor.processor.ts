import type { CstNodeLocation } from 'chevrotain';
import { JsdocSummary } from './jsdoc.js';
import type { Code } from './project.code.js';
import {
  Diagnostic,
  DiagnosticCollectionName,
  DiagnosticSeverity,
} from './project.diagnostics.js';
import { Position, Range, type Scope } from './project.location.js';
import { Type, type EnumType, type StructType } from './types.js';
import { assert } from './util.js';

export class SymbolProcessor {
  protected readonly localScopeStack: StructType[] = [];
  protected readonly selfStack: (StructType | EnumType)[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  public scope: Scope;
  readonly position: Position;
  public unusedJsdoc: { type: Type; jsdoc: JsdocSummary } | undefined;

  constructor(readonly file: Code) {
    this.scope = file.scopes[0];
    assert(
      this.scope,
      'SymbolProcessor constructor: File must have a global scope',
    );
    this.localScopeStack.push(this.scope.local);
    this.selfStack.push(this.scope.self);
    this.position = this.scope.start;
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
    kind: DiagnosticCollectionName,
    where: CstNodeLocation,
    message: string,
    severity: DiagnosticSeverity = 'warning',
  ) {
    this.file.addDiagnostic(
      kind,
      new Diagnostic(message, Range.fromCst(this.file, where), severity),
    );
  }

  get fullScope() {
    return {
      local: this.currentLocalScope,
      self: this.currentSelf,
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

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  get currentSelf() {
    return this.selfStack.at(-1) || this.project.self;
  }

  getGlobalSymbol(name: string) {
    return this.project.getGlobal(name);
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
    return new Type('Struct').definedAt(this.range(token, endToken));
  }

  pushScope(
    startToken: CstNodeLocation,
    self: StructType | EnumType,
    fromTokenEnd: boolean,
  ) {
    const localScope = this.createStruct(startToken);
    this.localScopeStack.push(localScope);
    this.nextScope(startToken, fromTokenEnd).local = localScope;
    this.selfStack.push(self);
    this.scope.self = self;
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

  pushSelfScope(
    startToken: CstNodeLocation,
    self: StructType | EnumType,
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

  popSelfScope(
    nextScopeToken: CstNodeLocation,
    nextScopeStartsFromTokenEnd: boolean,
  ) {
    this.selfStack.pop();
    this.nextScope(nextScopeToken, nextScopeStartsFromTokenEnd).self =
      this.currentSelf;
  }
}
