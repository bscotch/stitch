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
import {
  Enum,
  GlobalConstructorFunction,
  GlobalFunction,
  GlobalVariable,
  Macro,
  ProjectSymbol,
} from './symbols.symbol.js';

export function processGlobalSymbols(file: GmlFile) {
  const processor = new GlobalDeclarationsProcessor(file);
  const visitor = new GmlGlobalDeclarationsVisitor(processor);
  visitor.visit(file.cst);
}

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

  get globals() {
    return this.project.self;
  }

  get resource() {
    return this.file.resource;
  }

  get project() {
    return this.resource.project;
  }
}

export class GmlGlobalDeclarationsVisitor extends GmlVisitorBase {
  static validated = false;

  UPDATE_GLOBAL<T extends typeof ProjectSymbol>(
    children: { Identifier?: IToken[] },
    klass: T,
  ): InstanceType<T> | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    const location = this.PROCESSOR.location.at(name);
    // Only create it if it doesn't already exist.
    let symbol = this.PROCESSOR.globals.getSymbol(name.image);
    if (!symbol) {
      symbol = new klass(name.image, location) as any;
      this.PROCESSOR.globals.addSymbol(symbol as any);
    } else {
      symbol.location = location;
    }
    symbol!.addRef(location, true);
    return symbol as any;
  }

  findSymbols(input: CstNode) {
    this.visit(input);
    return this.PROCESSOR;
  }

  override enumStatement(children: EnumStatementCstChildren) {
    const _symbol = this.UPDATE_GLOBAL(children, Enum)!;
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
      const _symbol = this.UPDATE_GLOBAL(children, _constructor)!;
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
    this.UPDATE_GLOBAL(children, GlobalVariable)!;
  }

  override macroStatement(children: MacroStatementCstChildren) {
    this.UPDATE_GLOBAL(children, Macro)!;
  }

  constructor(readonly PROCESSOR: GlobalDeclarationsProcessor) {
    super();
    if (!GmlGlobalDeclarationsVisitor.validated) {
      // Validator logic only needs to run once, since
      // new instances will be the same.
      this.validateVisitor();
      GmlGlobalDeclarationsVisitor.validated = true;
    }
  }
}
