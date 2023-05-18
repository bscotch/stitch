// CST Visitor for creating an AST etc
import type { CstNode, IToken } from 'chevrotain';
import type {
  EnumStatementCstChildren,
  FunctionExpressionCstChildren,
  GlobalVarDeclarationCstChildren,
  IdentifierAccessorCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { GmlVisitorBase } from './parser.js';
import type { GmlFile } from './project.gml.js';
import { Location } from './project.locations.js';
import { LocalScope } from './project.scopes.js';
import { Enum, GlobalFunction, GlobalVar, Macro } from './project.symbols.js';

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

  ADD_GLOBAL_DECLARATION<T extends Enum | GlobalFunction | Macro | GlobalVar>(
    children: { Identifier?: IToken[] },
    klass: new (...args: any[]) => T,
    /**
     * Variables set without globalvar, using only global.NAME,
     * have no definite declaration location. */
    isNotDeclaration = false,
  ): T | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    const location = this.PROCESSOR.location.at(name);
    // Only create it if it doesn't already exist.
    let symbol = this.PROCESSOR.globals.getSymbol(name.image);
    if (!symbol) {
      symbol = new klass(name.image, location, isNotDeclaration) as any;
      this.PROCESSOR.globals.addSymbol(symbol as any);
    } else {
      const isDeclaration = !isNotDeclaration;
      if (isDeclaration) {
        // Then we need to override the original location.
        symbol.location = location;
      }
      symbol.addRef(location, isDeclaration);
    }
    return symbol as any;
  }

  extractGlobalDeclarations(input: CstNode) {
    this.visit(input);
    return this.PROCESSOR;
  }

  override enumStatement(children: EnumStatementCstChildren) {
    const _symbol = this.ADD_GLOBAL_DECLARATION(children, Enum)!;
    for (let i = 0; i < children.enumMember.length; i++) {
      const member = children.enumMember[i];
      const name = member.children.Identifier[0];
      _symbol.addMember(i, name, this.PROCESSOR.location.at(name));
    }
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
      const _symbol = this.ADD_GLOBAL_DECLARATION(children, GlobalFunction)!;
      if (children.constructorSuffix?.[0]) {
        _symbol.isConstructor = true;
      }
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
    this.ADD_GLOBAL_DECLARATION(children, GlobalVar)!;
  }

  override macroStatement(children: MacroStatementCstChildren) {
    this.ADD_GLOBAL_DECLARATION(children, Macro)!;
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    // Add global.whatever symbols
    const isGlobal = children.identifier[0].children.Global?.[0];
    if (isGlobal) {
      const identifier =
        children.accessorSuffixes?.[0].children.dotAccessSuffix?.[0].children
          .identifier[0].children;
      if (identifier?.Identifier) {
        this.ADD_GLOBAL_DECLARATION(identifier, GlobalVar, false);
      }
    }

    // Stil visit the rest
    if (children.accessorSuffixes) {
      this.visit(children.accessorSuffixes);
    }
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
