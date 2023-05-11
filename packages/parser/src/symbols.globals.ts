// CST Visitor for creating an AST etc
import type { CstNode, IToken } from 'chevrotain';
import type {
  EnumMemberCstChildren,
  EnumStatementCstChildren,
  FunctionExpressionCstChildren,
  GlobalVarDeclarationCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { GmlVisitorBase } from './parser.js';
import type { GmlFile } from './project.gml.js';
import { Location } from './symbols.location.js';
import { LocalScope } from './symbols.scopes.js';
import type { GlobalSymbol } from './symbols.self.js';
import {
  Enum,
  GlobalConstructorFunction,
  GlobalFunction,
  GlobalVariable,
  Macro,
  ProjectSymbol,
} from './symbols.symbol.js';

class GlobalDeclarationsProcessor {
  protected readonly localScopeStack: LocalScope[] = [];
  readonly location: Location;

  constructor(readonly file: GmlFile) {
    this.localScopeStack.push(file.scopeRanges[0].local);
    this.location = file.scopeRanges[0].start;
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  pushLocalScope() {
    const localScope = new LocalScope(this.file);
    this.localScopeStack.push(localScope);
  }

  popLocalScope() {
    this.localScopeStack.pop();
  }

  get resource() {
    return this.file.resource;
  }

  get project() {
    return this.resource.project;
  }
}

export function processGlobalSymbols(file: GmlFile) {
  const processor = new GlobalDeclarationsProcessor(file);
  const visitor = new GmlGlobalDeclarationsVisitor(processor);
  visitor.visit(file.cst);
}

export class GmlGlobalDeclarationsVisitor extends GmlVisitorBase {
  static validated = false;
  constructor(readonly PROCESSOR: GlobalDeclarationsProcessor) {
    super();
    if (!GmlGlobalDeclarationsVisitor.validated) {
      // Validator logic only needs to run once, since
      // new instances will be the same.
      this.validateVisitor();
      GmlGlobalDeclarationsVisitor.validated = true;
    }
  }

  INSTANCE<T extends typeof ProjectSymbol>(
    children: { Identifier?: IToken[] },
    klass: T,
  ): InstanceType<T> | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    return new klass(name.image, this.PROCESSOR.location.at(name)) as any;
  }

  ADD_GLOBAL_SYMBOL(_symbol: GlobalSymbol) {
    this.PROCESSOR.project.self.addSymbol(_symbol);
  }

  findSymbols(input: CstNode) {
    this.visit(input);
    return this.PROCESSOR;
  }

  override enumStatement(children: EnumStatementCstChildren) {
    const _symbol = this.INSTANCE(children, Enum)!;
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
        this.PROCESSOR.file.scopeRanges[0].local &&
      this.PROCESSOR.resource.type === 'scripts';
    // Functions create a new localscope
    this.PROCESSOR.pushLocalScope();
    const name = children.Identifier?.[0];
    // Add the function to a table of functions
    if (name && isGlobal) {
      const _constructor = children.constructorSuffix?.[0]
        ? GlobalConstructorFunction
        : GlobalFunction;
      const _symbol = this.INSTANCE(children, _constructor)!;
      this.ADD_GLOBAL_SYMBOL(_symbol);
      // Add function signature components
      const params =
        children.functionParameters?.[0]?.children.functionParameter || [];
      for (let i = 0; i < params.length; i++) {
        const param = params[i].children.Identifier[0];
        _symbol.addParam(i, param, this.PROCESSOR.location.at(param));
      }
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popLocalScope();
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    const _symbol = this.INSTANCE(children, GlobalVariable)!;
    this.ADD_GLOBAL_SYMBOL(_symbol);
  }

  override macroStatement(children: MacroStatementCstChildren) {
    const _symbol = this.INSTANCE(children, Macro)!;
    this.ADD_GLOBAL_SYMBOL(_symbol);
  }
}
