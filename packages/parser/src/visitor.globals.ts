// CST Visitor for creating an AST etc
import type { CstNode, CstNodeLocation, IToken } from 'chevrotain';
import {
  EnumStatementCstChildren,
  FunctionExpressionCstChildren,
  GlobalVarDeclarationCstChildren,
  IdentifierAccessorCstChildren,
  JsdocGmlCstChildren,
  JsdocJsCstChildren,
  MacroStatementCstChildren,
} from '../gml-cst.js';
import { JsdocSummary, parseJsdoc } from './jsdoc.js';
import { logger } from './logger.js';
import { GmlVisitorBase, identifierFrom } from './parser.js';
import type { Code } from './project.code.js';
import { Position, Range } from './project.location.js';
import { Signifier } from './signifiers.js';
import { typeFromParsedJsdocs } from './types.feather.js';
import { StructType, Type } from './types.js';
import { assert } from './util.js';

export function registerGlobals(file: Code) {
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
    const localScope = new Type('Struct');
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

  get globalSelf() {
    return this.project.self;
  }
}

/**
 * Visits the CST and creates symbols for global signifiers.
 */
export class GmlGlobalDeclarationsVisitor extends GmlVisitorBase {
  static validated = false;

  EXTRACT_GLOBAL_DECLARATIONS(input: CstNode) {
    this.PROCESSOR.file.callsSuper = false;
    // If we are reprocessing, we want the list of globals that used
    // to be declared here in case any have gone missing.
    this.visit(input);
    return this.PROCESSOR;
  }

  /**
   * Register a global identifier from its declaration. Note that
   * global identifiers are not deleted when their definitions are,
   * so we need to either create *or update* the corresponding symbol/typeMember.
   */
  REGISTER_GLOBAL(children: { Identifier?: IToken[] }): Signifier | undefined {
    const name = children.Identifier?.[0];
    if (!name) return;
    const range = this.PROCESSOR.range(name);
    return this.REGISTER_GLOBAL_BY_NAME(name.image, range);
  }

  REGISTER_GLOBAL_BY_NAME(name: string, range: Range) {
    // Create it if it doesn't already exist.
    let symbol = this.PROCESSOR.globalSelf.getMember(name);
    if (!symbol) {
      symbol = new Signifier(this.PROCESSOR.project.self, name);
      // Add the symbol and type to the project.
      this.PROCESSOR.globalSelf.addMember(symbol);
    }
    // Ensure it's defined here.
    symbol.definedAt(range);
    symbol.addRef(range, true);
    symbol.global = true;
    symbol.macro = false; // Reset macro status
    return symbol;
  }

  REGISTER_JSDOC_GLOBAL(jsdoc: JsdocSummary) {
    if (jsdoc.kind !== 'globalvar') {
      return;
    }
    const symbol = this.REGISTER_GLOBAL_BY_NAME(
      jsdoc.name!.content,
      Range.from(this.PROCESSOR.file, jsdoc.name!),
    );
    symbol.setType(typeFromParsedJsdocs(jsdoc, this.PROCESSOR.project.types));
    symbol.describe(jsdoc.description);
  }

  override jsdocJs(children: JsdocJsCstChildren) {
    this.REGISTER_JSDOC_GLOBAL(parseJsdoc(children.JsdocJs[0]));
  }

  override jsdocGml(children: JsdocGmlCstChildren) {
    for (const line of children.JsdocGmlLine) {
      this.REGISTER_JSDOC_GLOBAL(parseJsdoc(line));
    }
  }

  /**
   * Collect the enum symbol *and* its members, since all of those
   * are globally visible.
   */
  override enumStatement(children: EnumStatementCstChildren) {
    const symbol = this.REGISTER_GLOBAL(children)! as Signifier;
    assert(symbol, 'Enum symbol should exist');
    let type = symbol.getTypeByKind('Enum');
    if (!type) {
      symbol.setType(new Type('Enum'));
      type = symbol.getTypeByKind('Enum')!;
    }
    if (symbol.type.type.length > 1) {
      symbol.setType(type);
    }
    type.named(symbol.name);
    this.PROCESSOR.project.types.set(`Enum.${symbol.name}`, type);

    // Upsert the enum members
    const keepNames = new Set<string>();
    for (let i = 0; i < children.enumMember.length; i++) {
      const name = children.enumMember[i].children.Identifier[0];
      keepNames.add(name.image);
      const range = this.PROCESSOR.range(name);
      const memberType = new Type('EnumMember').named(name.image);
      // Does member already exist?
      const member =
        type.getMember(name.image) || type.addMember(name.image, memberType)!;
      member.setType(memberType);
      member.idx = i;
      member.definedAt(range);
      member.addRef(range, true);
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
      this.PROCESSOR.asset.assetKind === 'scripts';
    // Functions create a new localscope. Keeping track of that is important
    // for making sure that we're looking at a global function declaration.
    this.PROCESSOR.pushLocalScope();
    const name = children.Identifier?.[0];

    if (name && isGlobal) {
      // Add the function to a table of functions
      const isConstructor = !!children.constructorSuffix?.[0];
      const signifier = this.REGISTER_GLOBAL(children)!;
      // Make sure that the types all exist
      let type = signifier.getTypeByKind('Function');
      if (!type) {
        signifier.setType(new Type('Function').named(name.image));
        type = signifier.getTypeByKind('Function')!;
        this.PROCESSOR.project.types.set(`Function.${name.image}`, type);
      }
      if (signifier.type.type.length > 1) {
        signifier.setType(type);
      }
      // If it's a constructor, ensure the type exists
      if (isConstructor && !type.constructs) {
        type.constructs = new Type('Struct').named(name.image);
        type.constructs.signifier = signifier;
        this.PROCESSOR.project.types.set(
          `Struct.${name.image}`,
          type.constructs,
        );
      }
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popLocalScope();
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    this.REGISTER_GLOBAL(children) as Signifier;
  }

  override macroStatement(children: MacroStatementCstChildren) {
    const symbol = this.REGISTER_GLOBAL(children)!;
    symbol.macro = true;
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    // Add global.whatever symbols
    const identifier = identifierFrom(children);
    if (identifier?.type === 'Global') {
      const globalIdentifier =
        children.accessorSuffixes?.[0].children.dotAccessSuffix?.[0].children
          .identifier[0].children;
      if (globalIdentifier?.Identifier) {
        this.REGISTER_GLOBAL(globalIdentifier);
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
