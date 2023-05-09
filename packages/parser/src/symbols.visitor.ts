// CST Visitor for creating an AST etc
import type { CstNode, IToken } from 'chevrotain';
import type {
  FileCstChildren,
  FunctionExpressionCstChildren,
  FunctionParameterCstChildren,
  GmlVisitor,
  LocalVarDeclarationCstChildren,
} from '../gml-cst.js';
import { GmlParser } from './parser.js';

const GmlVisitorBase =
  new GmlParser().getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<unknown, unknown>;

export class LocalVariable {
  constructor(
    public readonly name: string,
    public readonly offset: number,
    public isParam = false,
  ) {}
}

export class LocalScope {
  localVariables = new Map<string, LocalVariable>();

  constructor(public readonly offset: number) {}

  addLocalVariable(token: IToken, isParam = false) {
    // TODO: If this variable already exists, emit a warning
    // and add it as a reference to the existing variable.
    this.localVariables.set(
      token.image,
      new LocalVariable(token.image, token.startOffset, isParam),
    );
  }
}

export class GmlSymbols {
  protected readonly localScopeStack: LocalScope[] = [];
  readonly localScopes: LocalScope[] = [];
  constructor() {
    this.pushLocalScope(0);
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  pushLocalScope(position: number) {
    const addLocalVariable = new LocalScope(position);
    this.localScopeStack.push(addLocalVariable);
    this.localScopes.push(addLocalVariable);
  }

  popLocalScope() {
    this.localScopeStack.pop();
  }
}

export class GmlSymbolVisitor extends GmlVisitorBase {
  RESULT = new GmlSymbols();
  constructor() {
    super();
    this.validateVisitor();
  }

  findSymbols(input: CstNode) {
    this.RESULT = new GmlSymbols();
    this.visit(input);
    return this.RESULT;
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
    this.RESULT.pushLocalScope(
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
    this.RESULT.popLocalScope();
  }

  override functionParameter(children: FunctionParameterCstChildren) {
    this.RESULT.currentLocalScope.addLocalVariable(
      children.Identifier[0],
      true,
    );
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    this.RESULT.currentLocalScope.addLocalVariable(children.Identifier[0]);
    if (children.assignmentRightHandSide) {
      this.visit(children.assignmentRightHandSide);
    }
  }
}

export const gmlSymbolVisitor = new GmlSymbolVisitor();
