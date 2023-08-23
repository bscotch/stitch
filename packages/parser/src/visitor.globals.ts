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
import { GmlVisitorBase } from './parser.js';
import { identifierFrom } from './parser.utility.js';
import type { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import { Position, Range } from './project.location.js';
import { Signifier } from './signifiers.js';
import { typeFromParsedJsdocs } from './types.feather.js';
import { FunctionType, StructType, Type } from './types.js';
import { StitchParserError, assert } from './util.js';

export function registerGlobals(file: Code) {
  try {
    const processor = new GlobalDeclarationsProcessor(file);
    const visitor = new GmlGlobalDeclarationsVisitor(processor);
    visitor.EXTRACT_GLOBAL_DECLARATIONS(file.cst);
  } catch (parseError) {
    const err = new StitchParserError(`Error parsing globals in ${file.path}`);
    err.cause = parseError;
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

  REGISTER_GLOBAL_BY_NAME(name: string, range: Range, isNotDef = false) {
    // Create it if it doesn't already exist.
    let symbol = this.PROCESSOR.globalSelf.getMember(name);
    if (!symbol) {
      symbol = new Signifier(this.PROCESSOR.project.self, name);
      // Add the symbol and type to the project.
      this.PROCESSOR.globalSelf.addMember(symbol);
    }
    // Ensure it's defined here.
    if (!isNotDef && !symbol.native) {
      symbol.definedAt(range);
    } else if (!isNotDef) {
      this.PROCESSOR.file.addDiagnostic(
        'INVALID_OPERATION',
        new Diagnostic(
          `"${name}" already exists as a built-in symbol.`,
          range,
          'warning',
        ),
      );
    }
    symbol.addRef(range, !isNotDef && !symbol.native);
    symbol.global = true;
    symbol.macro = false; // Reset macro status
    symbol.enum = false; // Reset enum status
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
    symbol.setType(
      typeFromParsedJsdocs(jsdoc, this.PROCESSOR.project.types, false),
    );
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
    symbol.enum = true;
    let type = symbol.getTypeByKind('Enum');
    if (!type) {
      symbol.setType(new Type('Enum'));
      type = symbol.getTypeByKind('Enum')!;
    }
    if (symbol.type.type.length > 1) {
      symbol.setType(type);
    }
    type.named(symbol.name);
    type.signifier = symbol;
    this.PROCESSOR.project.types.set(`Enum.${symbol.name}`, type);

    // Upsert the enum members
    for (let i = 0; i < children.enumMember.length; i++) {
      const name = children.enumMember[i].children.Identifier[0];
      const range = this.PROCESSOR.range(name);
      // Does member already exist?
      const member = type.getMember(name.image) || type.addMember(name.image)!;
      const memberType =
        member.type.type[0] || new Type('EnumMember').named(name.image);
      member.setType(memberType);
      memberType.signifier = member;
      member.enumMember = true;
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
      const constructorNode = children.constructorSuffix?.[0];
      let parentConstructs: StructType | undefined;

      if (constructorNode?.children.Identifier) {
        // Ensure that the parent type exists
        const parentName = constructorNode.children.Identifier[0]?.image;
        if (parentName) {
          const parentNameRange = this.PROCESSOR.range(
            constructorNode.children.Identifier[0],
          );
          const parentSignifier = this.REGISTER_GLOBAL_BY_NAME(
            parentName,
            parentNameRange,
            true,
          );
          let parentType = parentSignifier.type.type[0];
          if (!parentType) {
            parentType = new Type('Function').named(parentName);
            parentSignifier.setType(parentType);
          }

          // Ensure it has a constructs type
          parentType.isConstructor = true;
          parentConstructs =
            (parentType.self as StructType) ||
            new Type('Struct').named(parentName);
          parentType.self = parentConstructs;
          parentConstructs.signifier = parentSignifier;
          this.PROCESSOR.project.types.set(
            `Struct.${parentName}`,
            parentConstructs,
          );
        }
      }

      const signifier = this.REGISTER_GLOBAL(children)!;

      // Make sure that the types all exist
      let type = signifier.getTypeByKind('Function');
      if (!type) {
        // Create the type if needed, but if there's already an existing
        // type with this name grab that instead (helps reduce reference
        // problems during editing)
        const typeName = `Function.${name.image}`;
        type = (this.PROCESSOR.project.types.get(typeName) ||
          new Type('Function').named(name.image)) as FunctionType;
        signifier.setType(type);
        type = signifier.getTypeByKind('Function')!;
        this.PROCESSOR.project.types.set(typeName, type);
      }
      // Global functions can only have one type!
      if (signifier.type.type.length > 1) {
        signifier.setType(type);
      }

      // Reset the self context to account for the user changing a function
      // from a constructor to a regular function and vice versa
      type.self = undefined;

      // Ensure that the type links back to the signifier
      type.signifier = signifier;

      // If it's a constructor, ensure the type exists
      if (constructorNode) {
        type.self = (this.PROCESSOR.project.types.get(`Struct.${name.image}`) ||
          new Type('Struct').named(name.image)) as StructType;
        type.self.signifier = signifier;
        this.PROCESSOR.project.types.set(`Struct.${name.image}`, type.self);
      }
      if (parentConstructs && type.self) {
        type.self.extends = parentConstructs;
      }
      // Initialize the local scope
      type.local ||= Type.Struct;
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
