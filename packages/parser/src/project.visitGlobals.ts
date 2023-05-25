// CST Visitor for creating an AST etc
import assert, { ok } from 'assert';
import type { CstNode, CstNodeLocation, IToken } from 'chevrotain';
import type {
  EnumStatementCstChildren,
  FunctionExpressionCstChildren,
  GlobalVarDeclarationCstChildren,
  IdentifierAccessorCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { GmlVisitorBase } from './parser.js';
import type { Code } from './project.code.js';
import { Position, Range } from './project.location.js';
import { PrimitiveName } from './project.primitives.js';
import { Symbol } from './project.symbol.js';
import { EnumType, StructType, TypeMember } from './project.type.js';

export function processGlobalSymbols(file: Code) {
  const processor = new GlobalDeclarationsProcessor(file);
  const visitor = new GmlGlobalDeclarationsVisitor(processor);
  visitor.visit(file.cst);
}

class GlobalDeclarationsProcessor {
  protected readonly localScopeStack: StructType[] = [];
  readonly start: Position;

  constructor(readonly file: Code) {
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

/**
 * Visits the CST and creates symbols and types for global
 * declarations.
 */
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
    return symbol;
  }

  extractGlobalDeclarations(input: CstNode) {
    this.visit(input);
    return this.PROCESSOR;
  }

  /**
   * Collect the enum symbol *and* its members, since all of those
   * are globally visible.
   */
  override enumStatement(children: EnumStatementCstChildren) {
    const symbol = this.ADD_GLOBAL_DECLARATION(children, 'Enum')! as Symbol;
    const type = symbol.type as EnumType;
    assert(type.kind === 'Enum', `Symbol ${symbol.name} is not an enum.`);
    // Might be updating an existing enum, so mutate members instead
    // of wholesale replacing to maintain cross-references.
    for (let i = 0; i < children.enumMember.length; i++) {
      const name = children.enumMember[i].children.Identifier[0];
      const range = this.PROCESSOR.range(name);
      const memberType = this.PROCESSOR.file
        .createType('EnumMember')
        .named(name.image);
      // Does member already exist?
      let member = type.getMember(name.image);
      if (!member) {
        member = type.addMember(name.image, memberType);
      }
      member.type = memberType;
      member.idx = i;
      member.definedAt(range);
    }
    // TODO: Remove any members that are not defined here.
  }

  /**
   * Identify global function declarations and store them as
   * symbols or `global.` types. For constructors, add the
   * corresponding types.
   */
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
      const isConstructor = !!children.constructorSuffix?.[0];
      const _symbol = this.ADD_GLOBAL_DECLARATION(
        children,
        isConstructor ? 'Constructor' : 'Function',
      )!;
      const functionType = _symbol.type;
      ok(['Constructor', 'Function'].includes(functionType.kind));
      if (children.constructorSuffix?.[0]) {
        // Ensure that the struct type exists for this constructor function
        _symbol.type.constructs ||= this.PROCESSOR.file.createType('Struct');
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
