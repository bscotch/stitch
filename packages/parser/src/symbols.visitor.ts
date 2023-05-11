// CST Visitor for creating an AST etc
import type { CstNode } from 'chevrotain';
import type {
  EnumStatementCstChildren,
  FileCstChildren,
  FunctionExpressionCstChildren,
  FunctionParameterCstChildren,
  GlobalVarDeclarationCstChildren,
  GmlVisitor,
  IdentifierCstChildren,
  LocalVarDeclarationCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { EnumMemberCstChildren } from '../gml-cst.js';
import { GmlParser, parser } from './parser.js';
import type { GmlFile } from './project.gml.js';
import {
  Location,
  TokenOrOffset,
  asEndOffset,
  asStartOffset,
} from './symbols.location.js';
import { LocalScope, ScopeRange } from './symbols.scopes.js';
import type {
  GlobalSelf,
  GlobalSymbol,
  InstanceSelf,
  StructSelf,
} from './symbols.self.js';
import {
  Enum,
  GlobalFunction,
  GlobalVariable,
  Macro,
} from './symbols.symbol.js';

const GmlVisitorBase =
  new GmlParser().getBaseCstVisitorConstructorWithDefaults() as new (
    ...args: any[]
  ) => GmlVisitor<unknown, unknown>;

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
    this.pushLocalScope(0);
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

  pushSelfScope(offset: TokenOrOffset, self: SelfType) {
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

  ADD_GLOBAL_SYMBOL(_symbol: GlobalSymbol) {
    this.PROCESSOR.project.self.addSymbol(_symbol);
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

  override enumStatement(children: EnumStatementCstChildren) {
    const _symbol = new Enum(
      children.Identifier[0].image,
      this.PROCESSOR.location.at(children.Identifier[0]),
    );
    this.ADD_GLOBAL_SYMBOL(_symbol);
    this.visit(children.enumMember, _symbol);
  }

  override enumMember(children: EnumMemberCstChildren, _symbol: Enum) {
    const name = children.Identifier[0];
    _symbol.addMember(name, this.PROCESSOR.location.at(name));
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    const isGlobal =
      this.PROCESSOR.currentLocalScope ===
      this.PROCESSOR.file.scopeRanges[0].local;
    // Functions create a new localscope
    // TODO: Add new selfscope
    // Start a new scope where the parameters are defined
    this.PROCESSOR.pushLocalScope(
      children.functionParameters[0].location!.startOffset,
    );

    // TODO: Consume the prior JSDOC comment as the function's documentation
    const name = children.Identifier?.[0];

    // Add the function to a table of functions
    if (name && isGlobal) {
      const _symbol = new GlobalFunction(
        name.image,
        this.PROCESSOR.location.at(name),
      );
      this.ADD_GLOBAL_SYMBOL(_symbol);
      // Add function signature components
      for (const param of children.functionParameters) {
        const token =
          param.children.functionParameter![0].children.Identifier[0];
        _symbol.addParam(token, this.PROCESSOR.location.at(token));
      }
    }

    // Add the parameters as local variables
    this.visit(children.functionParameters);
    if (children.constructorSuffix) {
      this.visit(children.constructorSuffix);
    }
    this.visit(children.blockStatement);

    // End the scope
    // TODO: End the selfscope once it's added
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
    this.ADD_GLOBAL_SYMBOL(_symbol);
  }

  override macroStatement(children: MacroStatementCstChildren) {
    const _symbol = new Macro(
      children.Identifier[0].image,
      this.PROCESSOR.location.at(children.Identifier[0]),
    );
    this.ADD_GLOBAL_SYMBOL(_symbol);
    this.visit(children.assignmentRightHandSide);
  }

  /**
   * Fallback identifier handler */
  override identifier(children: IdentifierCstChildren) {
    const scope = this.PROCESSOR.scope;
    // TODO: Check if reference to a local symbol
    // TODO: Check if reference to a self symbol
    // TODO: Check if reference to a global symbol
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
      // Is it a selfvar?
      else if (scope.self.hasSymbol(token.image)) {
        const _symbol = scope.self.getSymbol(token.image)!;
        _symbol.addRef(location);
      }
      // Is it a globalvar (if self wasn't global)?
      else if (!scope.selfIsGlobal && scope.global.hasSymbol(token.image)) {
        const _symbol = this.PROCESSOR.project.self.getSymbol(token.image)!;
        _symbol.addRef(location);
      }
      // Is it a builtin global?
      else if (scope.global.gml.has(token.image)) {
        const _symbol = scope.global.gml.get(token.image)!;
        _symbol.addRef(location);
      }
    }
  }
}
