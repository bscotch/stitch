// CST Visitor for creating an AST etc
import type { CstNode, CstNodeLocation, IToken } from 'chevrotain';
import type {
  EnumStatementCstChildren,
  FunctionExpressionCstChildren,
  GlobalVarDeclarationCstChildren,
  IdentifierAccessorCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { logger } from './logger.js';
import { GmlVisitorBase, identifierFrom } from './parser.js';
import type { Code } from './project.code.js';
import { Position, Range } from './project.location.js';
import { Signifier } from './signifiers.js';
import { EnumType, StructType } from './types.js';
import { PrimitiveName } from './types.primitives.js';
import { assert } from './util.js';

export function processGlobalSymbols(file: Code) {
  try {
    const processor = new GlobalDeclarationsProcessor(file);
    const visitor = new GmlGlobalDeclarationsVisitor(processor);
    visitor.EXTRACT_GLOBAL_DECLARATIONS(file.cst);
  } catch (err) {
    logger.error(err);
  }
}

class GlobalDeclarationsProcessor {
  protected readonly localScopeStack: StructType[] = [];
  readonly start: Position;

  constructor(readonly file: Code) {
    this.localScopeStack.push(file.scopes[0].local);
    assert(file.scopes[0], 'File must have a global scope');
    this.start = file.scopes[0].start;
  }

  range(loc: CstNodeLocation) {
    return Range.fromCst(this.start.file, loc);
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  pushLocalScope() {
    const localScope = this.project.createStructType();
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

  /**
   * Register a global identifier from its declaration. Note that
   * global identifiers are not deleted when their definitions are,
   * so we need to either create *or update* the corresponding symbol/typeMember.
   */
  ADD_GLOBAL_DECLARATION<T extends PrimitiveName>(
    children: { Identifier?: IToken[] },
    typeName: T,
    addToGlobalSelf = false,
  ): Signifier | Signifier | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    const range = this.PROCESSOR.range(name);
    const type = this.PROCESSOR.project
      .createType(typeName)
      .definedAt(range)
      .named(name.image);

    // Create it if it doesn't already exist.
    let symbol = this.PROCESSOR.project.getGlobal(name.image)?.symbol as
      | Signifier
      | Signifier;
    if (!symbol) {
      symbol = new Signifier(this.PROCESSOR.project.self, name.image).addType(
        type,
      );
      if (typeName === 'Constructor') {
        // Ensure the constructed type exists
        symbol.type.constructs = this.PROCESSOR.project
          .createStructType('self')
          .named(name.image);
      }
      // Add the symbol and type to the project.
      this.PROCESSOR.project.addGlobal(symbol, addToGlobalSelf);
    }
    // Ensure it's defined here.
    symbol.definedAt(range);
    symbol.global = true;
    symbol.addRef(range);
    if (typeName === 'Constructor') {
      symbol.type.constructs?.definedAt(range);
    }
    return symbol;
  }

  EXTRACT_GLOBAL_DECLARATIONS(input: CstNode) {
    this.PROCESSOR.file.callsSuper = false;
    // If we are reprocessing, we want the list of globals that used
    // to be declared here in case any have gone missing.
    this.visit(input);
    return this.PROCESSOR;
  }

  /**
   * Collect the enum symbol *and* its members, since all of those
   * are globally visible.
   */
  override enumStatement(children: EnumStatementCstChildren) {
    const symbol = this.ADD_GLOBAL_DECLARATION(children, 'Enum')! as Signifier;
    assert(symbol, 'Enum symbol should exist');
    const type = symbol.type as EnumType;
    assert(
      type.kind === 'Enum',
      `Symbol ${symbol.name} is a ${type.kind} instead of an enum.`,
    );
    // Might be updating an existing enum, so mutate members instead
    // of wholesale replacing to maintain cross-references.
    assert(children.enumMember, 'Enum must have members');
    const keepNames = new Set<string>();
    for (let i = 0; i < children.enumMember.length; i++) {
      const name = children.enumMember[i].children.Identifier[0];
      keepNames.add(name.image);
      const range = this.PROCESSOR.range(name);
      const memberType = this.PROCESSOR.project
        .createType('EnumMember')
        .definedAt(range)
        .named(name.image);
      // Does member already exist?
      const member =
        type.getMember(name.image) || type.addMember(name.image, memberType);
      member.type.coerceTo(memberType);
      member.idx = i;
      member.definedAt(range);
      member.addRef(range);
    }
    // Flag this member as UNDECLARED so we can create diagnostics
    for (const member of type.listMembers()) {
      if (!keepNames.has(member.name)) {
        member.def = undefined;
      }
    }
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
    // Functions create a new localscope. Keeping track of that is important
    // for making sure that we're looking at a global function declaration.
    this.PROCESSOR.pushLocalScope();
    const name = children.Identifier?.[0];
    // Add the function to a table of functions
    if (name && isGlobal) {
      const isConstructor = !!children.constructorSuffix?.[0];
      this.ADD_GLOBAL_DECLARATION(
        children,
        isConstructor ? 'Constructor' : 'Function',
      )!;
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popLocalScope();
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    this.ADD_GLOBAL_DECLARATION(children, 'Unknown') as Signifier;
  }

  override macroStatement(children: MacroStatementCstChildren) {
    this.ADD_GLOBAL_DECLARATION(children, 'Macro')!;
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    // Add global.whatever symbols
    const identifier = identifierFrom(children);
    if (identifier?.type === 'Global') {
      const globalIdentifier =
        children.accessorSuffixes?.[0].children.dotAccessSuffix?.[0].children
          .identifier[0].children;
      if (globalIdentifier?.Identifier) {
        this.ADD_GLOBAL_DECLARATION(globalIdentifier, 'Unknown', true);
      }
    } else if (
      identifier?.type === 'Identifier' &&
      children.accessorSuffixes?.[0].children.functionArguments
    ) {
      // See if this is a function call for `event_inherited()`
      if (identifier.name === 'event_inherited') {
        this.PROCESSOR.file.callsSuper = true;
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
