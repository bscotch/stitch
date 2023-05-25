// CST Visitor for creating an AST etc
import { ok } from 'assert';
import type { CstNode, CstNodeLocation, IToken } from 'chevrotain';
import type {
  EnumStatementCstChildren,
  FunctionExpressionCstChildren,
  GlobalVarDeclarationCstChildren,
  IdentifierAccessorCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { GmlVisitorBase } from './parser.js';
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

  range(loc: CstNodeLocation) {
    return Range.fromCst(this.start.file, loc);
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
  ): Symbol | TypeMember | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    const range = this.PROCESSOR.range(name);
    const type = this.PROCESSOR.file.createType(typeName).definedAt(range);

    // Only create it if it doesn't already exist.
    let symbol = this.PROCESSOR.project.getGlobal(name.image)?.symbol as
      | Symbol
      | TypeMember;
    if (!symbol) {
      symbol = new Symbol(name.image).definedAt(range).addType(type);
      // Add the symbol and type to the project.
      this.PROCESSOR.project.addGlobal(symbol, addToGlobalSelf);
    } else {
      // It might already exist due to reloading a file, or due
      // to an ambiguous `global.` declaration, or due to a
      // re-declaration.
      if (!isNotDeclaration) {
        // Then we need to override the original location.
        symbol.definedAt(range);
      }
    }
    symbol.addRef(range, type);
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
      const _symbol = this.ADD_GLOBAL_DECLARATION(children, 'Function')!;
      const functionType = _symbol.type;
      ok(functionType.kind === 'Function');
      if (children.constructorSuffix?.[0]) {
        // Ensure that the struct type exists for this constructor function
        _symbol.type.constructs ||= this.PROCESSOR.file.createType('Struct');
      }

      // TODO: Move this into the local processor
      // Add function signature components
      functionType.clearParameters();
      const params =
        children.functionParameters?.[0]?.children.functionParameter || [];
      for (let i = 0; i < params.length; i++) {
        const param = params[i].children.Identifier[0];
        const range = this.PROCESSOR.range(param);
        // TODO: Use JSDocs to determine the type of the parameter
        const type = this.PROCESSOR.file.createType('Unknown').definedAt(range);
        const optional = !!params[i].children.Assign;
        type.addParameter(i, param.image, type, optional);
      }
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popLocalScope();
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    this.ADD_GLOBAL_DECLARATION(children, 'Unknown', true)!;
  }

  override macroStatement(children: MacroStatementCstChildren) {
    this.ADD_GLOBAL_DECLARATION(children, 'Macro')!;
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    // Add global.whatever symbols
    const isGlobal = children.identifier[0].children.Global?.[0];
    if (isGlobal) {
      const identifier =
        children.accessorSuffixes?.[0].children.dotAccessSuffix?.[0].children
          .identifier[0].children;
      if (identifier?.Identifier) {
        this.ADD_GLOBAL_DECLARATION(identifier, 'Unknown', false);
      }
    }

    // Still visit the rest
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
