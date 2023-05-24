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
import type { GmlFile } from './types.gml.js';
import { Position } from './types.location.js';
import { StructType } from './types.type.js';
import { Symbol } from './types.symbol.js';

export function processGlobalSymbols(file: GmlFile) {
  const processor = new GlobalDeclarationsProcessor(file);
  const visitor = new GmlGlobalDeclarationsVisitor(processor);
  visitor.visit(file.cst);
}

class GlobalDeclarationsProcessor {
  protected readonly localScopeStack: StructType[] = [];
  readonly start: Position;

  constructor(readonly file: GmlFile) {
    this.localScopeStack.push(file.scopes[0].local);
    this.start = file.scopes[0].start;
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  pushLocalScope() {
    const localScope = this.file.createStructType();
    this.localScopeStack.push(localScope);
  }

  popLocalScope() {
    this.localScopeStack.pop();
  }

  get globals() {
    return this.project.self;
  }

  get asset() {
    return this.file.asset;
  }

  get project() {
    return this.asset.project;
  }
}

export class GmlGlobalDeclarationsVisitor extends GmlVisitorBase {
  static validated = false;

  ADD_GLOBAL_SYMBOL(
    children: { Identifier?: IToken[] },
    klass: new (...args: any[]) => Symbol,
    /**
     * Variables set without globalvar, using only global.NAME,
     * have no definite declaration location. */
    isNotDeclaration = false,
  ): Symbol | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    const location = this.PROCESSOR.start.at(name);
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
    this.ADD_GLOBAL_SYMBOL(children, Enum)!;
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    const isGlobal =
      this.PROCESSOR.currentLocalScope ===
        this.PROCESSOR.file.scopes[0].local &&
      this.PROCESSOR.asset.type === 'scripts';
    // Functions create a new localscope
    this.PROCESSOR.pushLocalScope();
    const name = children.Identifier?.[0];
    // Add the function to a table of functions
    if (name && isGlobal) {
      const _symbol = this.ADD_GLOBAL_SYMBOL(children, GlobalFunction)!;
      if (children.constructorSuffix?.[0]) {
        _symbol.isConstructor = true;
      }
      // Add function signature components
      const params =
        children.functionParameters?.[0]?.children.functionParameter || [];
      for (let i = 0; i < params.length; i++) {
        const param = params[i].children.Identifier[0];
        _symbol.addParam(i, param, this.PROCESSOR.start.at(param));
      }
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popLocalScope();
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    this.ADD_GLOBAL_SYMBOL(children, GlobalVar)!;
  }

  override macroStatement(children: MacroStatementCstChildren) {
    this.ADD_GLOBAL_SYMBOL(children, Macro)!;
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    // Add global.whatever symbols
    const isGlobal = children.identifier[0].children.Global?.[0];
    if (isGlobal) {
      const identifier =
        children.accessorSuffixes?.[0].children.dotAccessSuffix?.[0].children
          .identifier[0].children;
      if (identifier?.Identifier) {
        this.ADD_GLOBAL_SYMBOL(identifier, GlobalVar, false);
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
