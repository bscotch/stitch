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
import { GlobalFunction, GlobalVar, Macro } from './project.symbols.js';
import type { GmlFile } from './types.gml.js';
import { Position, Range } from './types.location.js';
import { PrimitiveName } from './types.primitives.js';
import { Symbol } from './types.symbol.js';
import { StructType, TypeMember } from './types.type.js';

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

  get asset() {
    return this.file.asset;
  }

  get project() {
    return this.asset.project;
  }
}

export class GmlGlobalDeclarationsVisitor extends GmlVisitorBase {
  static validated = false;

  ADD_GLOBAL_DECLARATION<T extends PrimitiveName>(
    children: { Identifier?: IToken[] },
    typeName: T,
    addToGlobalSelf = false,
    /**
     * Variables set without globalvar, using only global.NAME,
     * have no definite declaration location. */
    isNotDeclaration = false,
  ) {
    const name = children.Identifier?.[0];
    if (!name) return;
    const range = Range.fromCst(this.PROCESSOR.start.file, name);

    // Only create it if it doesn't already exist.
    let symbol = this.PROCESSOR.project.getGlobal(name.image)?.symbol as
      | Symbol
      | TypeMember;
    if (!symbol) {
      symbol = new Symbol(name.image);
      symbol.def = range;
      const type = this.PROCESSOR.file.createType(typeName);
      type.def = range;
      symbol.addType(type);
      // Add the symbol and type to the project.
      this.PROCESSOR.project.addGlobal(symbol, addToGlobalSelf);
    } else {
      const isDeclaration = !isNotDeclaration;
      if (isDeclaration) {
        // Then we need to override the original location.
        symbol.def = range;
      }
      symbol.addRef(range, isDeclaration);
    }
    return symbol;
  }

  extractGlobalDeclarations(input: CstNode) {
    this.visit(input);
    return this.PROCESSOR;
  }

  override enumStatement(children: EnumStatementCstChildren) {
    this.ADD_GLOBAL_DECLARATION(children, 'Enum')!;
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    const isGlobal =
      this.PROCESSOR.currentLocalScope ===
        this.PROCESSOR.file.scopes[0].local &&
      this.PROCESSOR.asset.assetType === 'scripts';
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
        _symbol.addParam(i, param, this.PROCESSOR.start.at(param));
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
