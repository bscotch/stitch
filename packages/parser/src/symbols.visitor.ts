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
import { Location } from './symbols.location.js';
import { LocalScope, SelfScope } from './symbols.scopes.js';

const GmlVisitorBase =
  new GmlParser().getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<unknown, unknown>;

class SymbolProcessor {
  protected readonly localScopeStack: LocalScope[] = [];
  protected readonly selfScopeStack: SelfScope[] = [];
  readonly location: Location;

  constructor(readonly file: GmlFile) {
    this.location = new Location(file, 0);
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

  get currentSelfScope() {
    return this.selfScopeStack.at(-1) || this.project.self;
  }

  pushLocalScope(offset: number) {
    const localScope = new LocalScope(this.location.at(offset));
    this.localScopeStack.push(localScope);
    this.file.localScopes.push(localScope);
  }

  popLocalScope() {
    this.localScopeStack.pop();
  }

  pushSelfScope(self: SelfScope) {
    this.selfScopeStack.push(self);
    this.file.selfScopes.push(self);
  }

  popSelfScope() {
    this.selfScopeStack.pop();
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
    this.PROCESSOR.popLocalScope();
  }

  override functionParameter(children: FunctionParameterCstChildren) {
    this.PROCESSOR.currentLocalScope.addVariable(children.Identifier[0], true);
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    this.PROCESSOR.currentLocalScope.addVariable(children.Identifier[0]);
    if (children.assignmentRightHandSide) {
      this.visit(children.assignmentRightHandSide);
    }
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    this.PROCESSOR.file.resource.project.self.symbo(children.Identifier[0]);
  }
}
