// CST Visitor for creating an AST etc
import type { CstNode } from 'chevrotain';
import type {
  FunctionExpressionCstChildren,
  FunctionParameterCstChildren,
  IdentifierCstChildren,
  LocalVarDeclarationCstChildren,
  StaticVarDeclarationsCstChildren,
} from '../gml-cst.js';
import { GmlVisitorBase } from './parser.js';
import type { GmlFile } from './project.gml.js';
import { Location, RawLocation } from './symbols.location.js';
import { LocalScope, ScopeRange } from './symbols.scopes.js';
import {
  GlobalSelf,
  GlobalSymbol,
  InstanceSelf,
  StructSelf,
} from './symbols.self.js';
import { enableLogging } from './util.js';

type SelfType = InstanceSelf | StructSelf | GlobalSelf;

class SymbolProcessor {
  protected readonly localScopeStack: LocalScope[] = [];
  protected readonly selfStack: SelfType[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  protected scopeRange: ScopeRange;
  readonly location: Location;

  constructor(readonly file: GmlFile) {
    this.scopeRange = file.scopeRanges[0];
    this.localScopeStack.push(this.scopeRange.local);
    this.location = this.scopeRange.start;
    this.pushLocalScope({ startOffset: 0 });
  }

  get scope() {
    return {
      local: this.currentLocalScope,
      self: this.currentSelf,
      global: this.project.self,
      selfIsGlobal: this.currentSelf === this.project.self,
    };
  }

  get resource() {
    return this.file.resource;
  }

  get project() {
    return this.resource.project;
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  get currentSelf() {
    return this.selfStack.at(-1) || this.project.self;
  }

  getGlobalSymbol(name: string): GlobalSymbol | undefined {
    return this.project.self.getSymbol(name);
  }

  protected nextScopeRange(token: RawLocation) {
    this.scopeRange = this.scopeRange.createNext(token);
    this.file.scopeRanges.push(this.scopeRange);
    return this.scopeRange;
  }

  pushScope(token: RawLocation, self: SelfType) {
    const localScope = new LocalScope(this.location.at(token));
    this.localScopeStack.push(localScope);
    this.nextScopeRange(token).local = localScope;
    this.selfStack.push(self);
    this.scopeRange.self = self;
  }

  popScope(token: RawLocation) {
    this.localScopeStack.pop();
    this.selfStack.pop();
    this.nextScopeRange(token).local = this.currentLocalScope;
    this.scopeRange.self = this.currentSelf;
  }

  pushLocalScope(token: RawLocation) {
    const localScope = new LocalScope(this.location.at(token));
    this.localScopeStack.push(localScope);
    this.nextScopeRange(token).local = localScope;
  }

  popLocalScope(token: RawLocation) {
    this.localScopeStack.pop();
    this.nextScopeRange(token).local = this.currentLocalScope;
  }

  pushSelfScope(token: RawLocation, self: SelfType) {
    this.selfStack.push(self);
    this.nextScopeRange(token).self = self;
  }

  popSelfScope(token: RawLocation) {
    this.selfStack.pop();
    this.nextScopeRange(token).self = this.currentSelf;
  }
}

export function processSymbols(file: GmlFile) {
  const processor = new SymbolProcessor(file);
  const visitor = new GmlSymbolVisitor(processor);
  visitor.visit(file.cst);
}

export class GmlSymbolVisitor extends GmlVisitorBase {
  static validated = false;
  constructor(readonly PROCESSOR: SymbolProcessor) {
    super();
    if (!GmlSymbolVisitor.validated) {
      // Validator logic only needs to run once, since
      // new instances will be the same.
      this.validateVisitor();
      GmlSymbolVisitor.validated = true;
    }
  }

  findSymbols(input: CstNode) {
    this.visit(input);
    return this.PROCESSOR;
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    const location = this.PROCESSOR.location.at(
      children.Identifier?.[0] || children.Function[0],
    );
    // Functions create a new localscope
    // If this is a constructor, add a new self scope
    // for it.
    let self = this.PROCESSOR.currentSelf;
    if (children.constructorSuffix?.[0].children) {
      self = new StructSelf();
      self.addRef(location);
    }
    this.PROCESSOR.pushScope(
      children.functionParameters[0].children.StartParen[0],
      self,
    );

    // Add the parameters as local variables
    this.visit(children.functionParameters);
    if (children.constructorSuffix) {
      this.visit(children.constructorSuffix);
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popScope(children.blockStatement[0].children.EndBrace[0]);
  }

  override functionParameter(children: FunctionParameterCstChildren) {
    this.PROCESSOR.currentLocalScope.addSymbol(children.Identifier[0], true);
  }

  override staticVarDeclarations(children: StaticVarDeclarationsCstChildren) {
    // Add to the self scope.
    const self = this.PROCESSOR.currentSelf as StructSelf;
    self.addSymbol(this.PROCESSOR.file, children.Identifier[0]);
    this.visit(children.assignmentRightHandSide);
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    if (this.PROCESSOR.file.name === 'BschemaConstructors') {
      enableLogging();
    }
    this.PROCESSOR.currentLocalScope.addSymbol(children.Identifier[0]);
    if (children.assignmentRightHandSide) {
      this.visit(children.assignmentRightHandSide);
    }
  }

  /**
   * Fallback identifier handler */
  override identifier(children: IdentifierCstChildren) {
    const scope = this.PROCESSOR.scope;
    // TODO: If we are in an object's create and this is from an assignment,
    //       then add it to the self scope
    // TODO: Infer self
    // TODO: If this isn't definitely a reference to a known symbol,
    //       then add it as an unknown symbol to be checked later.
    if (children.Identifier?.[0]) {
      const token = children.Identifier[0];
      const location = this.PROCESSOR.location.at(token);
      // Is it a localvar?
      if (scope.local.hasSymbol(token.image)) {
        const _symbol = scope.local.getSymbol(token.image)!;
        _symbol.addRef(location);
      }
      // Is it a non-global selfvar?
      else if (!scope.selfIsGlobal && scope.self.hasSymbol(token.image)) {
        const _symbol = scope.self.getSymbol(token.image)!;
        _symbol.addRef(location);
      }
      // Is it a globalvar?
      else if (scope.global.hasSymbol(token.image)) {
        const _symbol = this.PROCESSOR.project.self.getSymbol(token.image)!;
        _symbol.addRef(location);
      }
      // Is it a builtin global?
      else if (scope.global.gml.has(token.image)) {
        const _symbol = scope.global.gml.get(token.image)!;
        _symbol.addRef(location);
      }
      // TODO: Emit error?
    }
  }
}
