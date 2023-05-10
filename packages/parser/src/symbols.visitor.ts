// CST Visitor for creating an AST etc
import type { CstNode } from 'chevrotain';
import type {
  FileCstChildren,
  FunctionExpressionCstChildren,
  FunctionParameterCstChildren,
  GlobalVarDeclarationCstChildren,
  GmlVisitor,
  LocalVarDeclarationCstChildren,
} from '../gml-cst.js';
import { GmlParser, parser } from './parser.js';
import type { GmlFile } from './project.gml.js';
import {
  Location,
  TokenOrOffset,
  asEndOffset,
  asStartOffset,
} from './symbols.location.js';
import { LocalScope, ScopeRange } from './symbols.scopes.js';
import type { Self } from './symbols.self.js';
import { GlobalVariable } from './symbols.symbol.js';

const GmlVisitorBase =
  new GmlParser().getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<unknown, unknown>;

class SymbolProcessor {
  protected readonly localScopeStack: LocalScope[] = [];
  protected readonly selfStack: Self[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  protected scopeRange: ScopeRange;
  readonly location: Location;

  constructor(readonly file: GmlFile) {
    this.scopeRange = file.scopeRanges[0];
    this.localScopeStack.push(this.scopeRange.local);
    this.location = this.scopeRange.start;
    this.pushLocalScope(0);
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

  protected nextScopeRange(offset: number) {
    this.scopeRange = this.scopeRange.createNext(offset);
    this.file.scopeRanges.push(this.scopeRange);
    return this.scopeRange;
  }

  pushLocalScope(offset: TokenOrOffset) {
    offset = asStartOffset(offset);
    const localScope = new LocalScope(this.location.at(offset));
    this.localScopeStack.push(localScope);
    this.nextScopeRange(offset).local = localScope;
  }

  popLocalScope(offset: TokenOrOffset) {
    offset = asEndOffset(offset);
    this.localScopeStack.pop();
    this.nextScopeRange(offset).local = this.currentLocalScope;
  }

  pushSelfScope(offset: TokenOrOffset, self: Self) {
    offset = asStartOffset(offset);
    this.selfStack.push(self);
    this.nextScopeRange(offset).self = self;
  }

  popSelfScope(offset: TokenOrOffset) {
    offset = asEndOffset(offset);
    this.selfStack.pop();
    this.nextScopeRange(offset).self = this.currentSelf;
  }
}

export function processSymbols(file: GmlFile) {
  const parsed = parser.parse(file.content);
  // TODO: Handle error logic and emits
  const processor = new SymbolProcessor(file);
  const visitor = new GmlSymbolVisitor(processor);
  visitor.visit(parsed.cst);
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

  override file(children: FileCstChildren) {
    for (const statement of children.statements) {
      this.visit(statement);
    }
    return;
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    // Functions create a new localscope
    // Start a new scope where the parameters are defined
    this.PROCESSOR.pushLocalScope(
      children.functionParameters[0].location!.startOffset,
    );
    // TODO: Consume the prior JSDOC comment as the function's documentation
    // TODO: Add the function to a table of functions?
    // TODO: Add the parameters as local variables
    this.visit(children.functionParameters);
    if (children.constructorSuffix) {
      this.visit(children.constructorSuffix);
    }
    this.visit(children.blockStatement);
    this.PROCESSOR.popLocalScope(
      children.blockStatement[0].children.EndBrace[0].startOffset + 1,
    );
  }

  override functionParameter(children: FunctionParameterCstChildren) {
    this.PROCESSOR.currentLocalScope.addSymbol(children.Identifier[0], true);
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    this.PROCESSOR.currentLocalScope.addSymbol(children.Identifier[0]);
    if (children.assignmentRightHandSide) {
      this.visit(children.assignmentRightHandSide);
    }
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    const _symbol = new GlobalVariable(
      children.Identifier[0].image,
      this.PROCESSOR.location.at(children.Identifier[0]),
    );
    this.PROCESSOR.project.self.addSymbol(_symbol);
  }
}
