// CST Visitor for creating an AST etc
import { arrayWrapped } from '@bscotch/utility';
import type { CstNode } from 'chevrotain';
import type {
  ArrayLiteralCstChildren,
  AssignmentRightHandSideCstChildren,
  CatchStatementCstChildren,
  ExpressionCstChildren,
  FunctionExpressionCstChildren,
  FunctionStatementCstChildren,
  GlobalVarDeclarationCstChildren,
  IdentifierAccessorCstChildren,
  IdentifierCstChildren,
  JsdocGmlCstChildren,
  JsdocJsCstChildren,
  LocalVarDeclarationCstChildren,
  MacroStatementCstChildren,
  MultilineDoubleStringLiteralCstChildren,
  MultilineSingleStringLiteralCstChildren,
  ParenthesizedExpressionCstChildren,
  PrimaryExpressionCstChildren,
  ReturnStatementCstChildren,
  StaticVarDeclarationsCstChildren,
  StringLiteralCstChildren,
  StructLiteralCstChildren,
  TemplateLiteralCstChildren,
  VariableAssignmentCstChildren,
  WithStatementCstChildren,
} from '../gml-cst.js';
import { JsdocSummary, gmlLinesByGroup, parseJsdoc } from './jsdoc.js';
import { logger } from './logger.js';
import { GmlVisitorBase, VisitorContext, withCtxKind } from './parser.js';
import {
  functionFromRhs,
  identifierFrom,
  sortChildren,
  stringLiteralAsString,
} from './parser.utility.js';
import type { Code } from './project.code.js';
import {
  Position,
  Range,
  Reference,
  StructNewMemberRange,
} from './project.location.js';
import { Signifier } from './signifiers.js';
import { getTypeOfKind, getTypes, normalizeType } from './types.checks.js';
import { typeFromParsedJsdocs } from './types.feather.js';
import {
  EnumType,
  Type,
  TypeStore,
  WithableType,
  type StructType,
} from './types.js';
import { withableTypes } from './types.primitives.js';
import { StitchParserError, assert } from './util.js';
import { assignVariable, ensureDefinitive } from './visitor.assign.js';
import { visitFunctionExpression } from './visitor.functionExpression.js';
import { visitIdentifierAccessor } from './visitor.identifierAccessor.js';
import {
  SignifierProcessor,
  diagnosticCollections,
} from './visitor.processor.js';

export function registerSignifiers(file: Code) {
  try {
    // Clear diagnostics managed by the processor
    for (const group of diagnosticCollections) {
      file.clearDiagnosticCollection(group);
    }
    const processor = new SignifierProcessor(file);
    const visitor = new GmlSignifierVisitor(processor);
    visitor.UPDATE_SIGNIFIERS(file.cst);
  } catch (parseErr) {
    const err = new StitchParserError(
      `Error identifying locals in ${file.path}`,
    );
    err.cause = parseErr;
    logger.error(err);
  }
}

export interface FindSignifierOptions {
  excludeParents?: boolean;
  excludeGlobal?: boolean;
}

export class GmlSignifierVisitor extends GmlVisitorBase {
  static validated = false;
  constructor(readonly PROCESSOR: SignifierProcessor) {
    super();
    this.validateVisitor();
  }

  get FILE() {
    return this.PROCESSOR.file;
  }

  get ASSET() {
    return this.PROCESSOR.asset;
  }

  /** Entrypoint */
  UPDATE_SIGNIFIERS(input: CstNode) {
    this.visit(input, { ctxKindStack: [] });
    this.PROCESSOR.setLastScopeEnd(input.location!);
    return this.PROCESSOR;
  }

  override visit(cstNode: CstNode | CstNode[], ctx: VisitorContext) {
    return super.visit(cstNode, ctx);
  }

  protected FIND_ITEM_BY_NAME(
    name: string,
    options?: FindSignifierOptions,
  ): Signifier | undefined {
    const scope = this.PROCESSOR.fullScope;

    // Find matches from all scopes, then return the first declared one.
    // If none are declared, return the first found.
    const matches = [
      // Local scope
      scope.local.getMember(
        name,
        false, // Locals should always search parents, since `catch` statements are the only thing that extend local scope
      ),
      // Self scope
      scope.selfIsGlobal
        ? undefined
        : scope.self.getMember(name, options?.excludeParents),
      // Global scope
      options?.excludeGlobal
        ? undefined
        : this.FIND_GLOBAL_BY_NAME(name, options),
    ].filter((i) => i !== undefined) as Signifier[];
    return matches.find((i) => i.def) || matches[0];
  }

  protected FIND_GLOBAL_BY_NAME(
    name: string,
    options: FindSignifierOptions | undefined,
  ) {
    const scope = this.PROCESSOR.fullScope;
    const item: Signifier | undefined = this.PROCESSOR.globalSelf.getMember(
      name,
      options?.excludeParents,
    );
    // If the current scope is an instance allow for instance variables
    // (but skip `id` since we're doing special things with that).
    // Otherwise instance variables should be skipped.
    const isInstance =
      !scope.selfIsGlobal &&
      (['Id.Instance', 'Asset.GMObject'].includes(scope.self.kind) ||
        scope.self.signifier?.asset);
    if (!isInstance && item?.instance) {
      return undefined;
    } else if (isInstance && item?.instance && name === 'id') {
      // Then this is a native "instance" variable. Ignore it
      // to allow falling back on the self scope.
      return undefined;
    }
    return item;
  }

  /** Given an identifier in the current scope, find the corresponding item. */
  protected FIND_ITEM(
    children: IdentifierCstChildren,
    options?: FindSignifierOptions,
  ): { item: Signifier | WithableType | EnumType; range: Range } | undefined {
    const identifier = identifierFrom(children);
    if (!identifier) {
      return;
    }
    const scope = this.PROCESSOR.fullScope;
    let item: Signifier | WithableType | EnumType | undefined;
    const range = this.PROCESSOR.range(identifier.token);
    switch (identifier.type) {
      case 'Global':
        // Global is a special case, it's a keyword and also
        // a globalvar.
        item = scope.global;
        break;
      case 'Self':
        // Then we're referencing our current self context
        item = scope.self;
        // If this self scope is also global, emit a diagnostic
        // (should not use self to refer to global)
        if (scope.selfIsGlobal) {
          this.PROCESSOR.addDiagnostic(
            'GLOBAL_SELF',
            children.Self![0],
            '`self` refers to the global scope here, which is probably unintentional.',
          );
        } else {
          item.signifier?.addRef(range);
        }
        break;
      case 'Other':
        // Then we're referencing the self-scope upstream of this one.
        item = this.PROCESSOR.outerSelf;
        // If this self scope is also global, emit a diagnostic
        // (should not use self to refer to global)
        if (this.PROCESSOR.outerSelf === scope.global) {
          this.PROCESSOR.addDiagnostic(
            'GLOBAL_SELF',
            children.Other![0],
            '`other` refers to the global scope here, which is probably unintentional.',
          );
        } else {
          item.signifier?.addRef(range);
        }
        break;
      default:
        const { name } = identifier;
        item = this.FIND_ITEM_BY_NAME(name, options);
        break;
    }
    if (item) {
      return {
        item,
        range,
      };
    }
    return;
  }

  get ANY() {
    return new Type('Any');
  }

  get BOOLEAN() {
    return new Type('Bool');
  }

  get REAL() {
    return new Type('Real');
  }

  get UNDEFINED() {
    return new Type('Undefined');
  }

  /**
   * Given parsed JSDocs, convert into a Type and store
   * it for use by the next symbol.
   */
  PREPARE_JSDOC(jsdoc: JsdocSummary) {
    const type = typeFromParsedJsdocs(
      jsdoc,
      this.PROCESSOR.project.types,
      false,
    );
    this.PROCESSOR.unusedJsdoc = {
      jsdoc,
      type,
    };
    this.PROCESSOR.file.jsdocs.push(jsdoc);

    // Add references to types where appropriate
    for (const loc of jsdoc.typeRanges) {
      const signifier = this.PROCESSOR.project.types.get(loc.content)
        ?.signifier;
      if (!signifier) continue;
      signifier.addRef(Range.from(this.PROCESSOR.file, loc));
    }

    // If we're documenting a variable, then we need to
    // go ahead and consume the doc.
    // globalvars should have already been handled and can be skipped
    if (!['localvar', 'instancevar', 'globalvar'].includes(jsdoc.kind)) {
      return;
    }
    const info = this.PROCESSOR.consumeJsdoc()!;
    if (jsdoc.kind === 'globalvar') {
      return;
    }
    const container =
      jsdoc.kind === 'localvar'
        ? this.PROCESSOR.currentLocalScope
        : this.PROCESSOR.currentSelf;
    if (container === this.PROCESSOR.globalSelf) {
      // Then this is being used improperly
      this.PROCESSOR.addDiagnostic(
        'GLOBAL_SELF',
        jsdoc.name!,
        `Invalid variable documentation. Did you mean to use @globalvar?`,
        'error',
      );
      return;
    }
    let signifier = container.getMember(jsdoc.name!.content);
    const nameRange = Range.from(this.PROCESSOR.file, jsdoc.name!);
    if (!signifier) {
      signifier = new Signifier(container, jsdoc.name!.content);
      container.addMember(signifier);
      if (container === this.PROCESSOR.currentDefinitiveSelf) {
        signifier.definitive = true;
      }
      signifier.addRef(nameRange, true);
    } else {
      const ref = signifier.addRef(nameRange);
      ensureDefinitive(
        container as WithableType,
        this.PROCESSOR.currentDefinitiveSelf,
        signifier,
        ref,
      );
    }
    signifier.describe(jsdoc.description);
    signifier.setType(info.type);
    signifier.definedAt(nameRange);
    if (jsdoc.kind === 'localvar') {
      signifier.local = true;
    } else {
      signifier.instance = true;
    }
  }

  override jsdocJs(children: JsdocJsCstChildren) {
    this.PREPARE_JSDOC(parseJsdoc(children.JsdocJs[0]));
  }

  override jsdocGml(children: JsdocGmlCstChildren) {
    // This *could* actually be several JSDocs,
    const jsdocGroups = gmlLinesByGroup(children.JsdocGmlLine);
    for (const group of jsdocGroups) {
      const parsed = parseJsdoc(group);
      this.PREPARE_JSDOC(parsed);
    }
  }

  override withStatement(
    children: WithStatementCstChildren,
    context: VisitorContext,
  ) {
    const blockLocation = children.blockableStatement[0].location!;
    // With statements change the self scope to
    // whatever their expression evaluates to.
    // Evaluate the expression and try to use its type as the self scope
    const docs = this.PROCESSOR.consumeJsdoc();
    const contextExpression = this.expression(
      children.expression[0].children,
      withCtxKind(context, 'withCondition'),
    );
    const contextFromDocs =
      docs?.jsdoc.kind === 'self' ? docs.type[0] : undefined;

    const self =
      getTypeOfKind(contextFromDocs, withableTypes) ||
      getTypeOfKind(contextExpression, withableTypes) ||
      this.PROCESSOR.createStruct(blockLocation);

    this.PROCESSOR.scope.setEnd(children.expression[0].location!, true);
    this.PROCESSOR.pushSelfScope(blockLocation, self, false);

    this.visit(children.blockableStatement, withCtxKind(context, 'withBody'));

    this.PROCESSOR.scope.setEnd(blockLocation, true);
    this.PROCESSOR.popSelfScope(blockLocation, true);
    return;
  }

  override catchStatement(
    children: CatchStatementCstChildren,
    ctx: VisitorContext,
  ) {
    // Catch statements are weird because they add a new variable
    // the the current localscope, but only within themselves. We
    // can get a reasonable approximation of this behavior by creating
    // a new localscope that has the current localscope as a parent.
    const catchLocal = Type.Struct;
    catchLocal.extends = this.PROCESSOR.currentLocalScope;
    this.PROCESSOR.pushLocalScope(children.Catch[0], true, catchLocal);

    // Add the identifier to the new localscope
    const identifier = identifierFrom(children);
    if (identifier) {
      const range = this.PROCESSOR.range(identifier.token);
      const type =
        this.PROCESSOR.project.types.get('Struct.Exception')?.derive() ||
        new Type('Any');
      const signifier = this.PROCESSOR.currentLocalScope.addMember(
        identifier.name,
        { type },
      )!;
      signifier.addRef(range, true);
      signifier.definedAt(range);
      signifier.local = true;
    }
    this.visit(children.blockStatement, ctx);

    this.PROCESSOR.popLocalScope(children.blockStatement[0].location!, true);
  }

  override functionStatement(
    children: FunctionStatementCstChildren,
    ctx: VisitorContext,
  ) {
    this.functionExpression(
      children.functionExpression[0].children,
      withCtxKind(ctx, 'functionStatement'),
    );
  }

  override functionExpression(
    children: FunctionExpressionCstChildren,
    context: VisitorContext,
  ) {
    return visitFunctionExpression.call(this, children, context);
  }

  override returnStatement(
    children: ReturnStatementCstChildren,
    ctx: VisitorContext,
  ): (Type | TypeStore)[] {
    const returnType = children.assignmentRightHandSide
      ? this.assignmentRightHandSide(
          children.assignmentRightHandSide[0].children,
          withCtxKind(ctx, 'functionReturn'),
        )
      : this.UNDEFINED;
    ctx.returns?.push(...arrayWrapped(returnType));
    return arrayWrapped(returnType);
  }

  /** Called on *naked* identifiers and those that have accessors/suffixes of various sorts. */
  override identifierAccessor(
    children: IdentifierAccessorCstChildren,
    context: VisitorContext,
  ): (Type | TypeStore)[] {
    return arrayWrapped(visitIdentifierAccessor.call(this, children, context));
  }

  override macroStatement(
    children: MacroStatementCstChildren,
    ctx: VisitorContext,
  ) {
    // Macros are just references to some expression, so set their
    // type the the type of that expression.
    // Macros are defined during global parsing, so we can assume
    // that they exist.
    const signifier = this.FIND_ITEM_BY_NAME(children.Identifier[0].image);
    assert(signifier, 'Macro should exist');

    // If the macro ends with a ';' then it's a statement, otherwise
    // we can treat it like a variable.
    const isStatement = children.expressionStatement?.[0]?.children.Semicolon;
    const expression =
      children.expressionStatement?.[0]?.children.expression?.[0]?.children;
    const expressionType = expression && this.expression(expression, ctx);

    const inferredType = isStatement
      ? Type.Undefined
      : normalizeType(expressionType, this.PROCESSOR.project.types);
    signifier.setType(inferredType);
  }

  /** Static params are unambiguously defined. */
  override staticVarDeclarations(
    children: StaticVarDeclarationsCstChildren,
    ctx: VisitorContext,
  ) {
    // The same as a regular non-var assignment, except we
    // need to indicate that it is static.
    return this.variableAssignment(children, { ...ctx, isStatic: true });
  }

  override globalVarDeclaration(children: GlobalVarDeclarationCstChildren) {
    // Allow overriding the type with JSDocs
    const identity = identifierFrom(children);
    const docs = this.PROCESSOR.consumeJsdoc();
    if (!identity) {
      return;
    }
    const signifier = this.PROCESSOR.globalSelf.getMember(identity.name);
    assert(signifier, `Global var ${identity.name} should exist`);
    // Get the reference added
    const ref = signifier.addRef(this.PROCESSOR.range(identity.token), true);
    // This signifier should already be registered via the global pass
    // so we just need to update its type.
    if (docs?.jsdoc.kind && ['type', 'description'].includes(docs.jsdoc.kind)) {
      signifier.describe(docs.jsdoc.description);
      signifier.setType(docs.type);
    }
    return {
      item: signifier,
      ref,
    };
  }

  override localVarDeclaration(
    children: LocalVarDeclarationCstChildren,
    ctx: VisitorContext,
  ) {
    const docs = this.PROCESSOR.consumeJsdoc();
    const local = this.PROCESSOR.currentLocalScope;
    const range = this.PROCESSOR.range(children.Identifier[0]);
    const name = children.Identifier[0].image;
    return assignVariable(
      this,
      { container: local, name, range },
      children.assignmentRightHandSide,
      { ctx, docs, local: true },
    );
  }

  override variableAssignment(
    children: VariableAssignmentCstChildren,
    ctx: VisitorContext,
  ) {
    // Determine the args for ASSIGN
    const name = children.Identifier[0].image;
    const range = this.PROCESSOR.range(children.Identifier[0]);
    const rhs = children.assignmentRightHandSide;
    const docs = this.PROCESSOR.consumeJsdoc();

    // Determine the container for this variable
    const { isStatic } = ctx;
    ctx.isStatic = false; // Reset to prevent downstream confusion
    const assignedToFunction = !!functionFromRhs(rhs);
    const excludeGlobal = !!(isStatic || assignedToFunction);
    const excludeParents = !!(isStatic || assignedToFunction);
    let container: WithableType | undefined = (
      this.FIND_ITEM(children, {
        excludeGlobal,
        excludeParents,
      })?.item as Signifier | undefined
    )?.parent as WithableType | undefined;
    if (!container) {
      const fullScope = this.PROCESSOR.fullScope;
      // Add to the self-scope unless it's a static inside a non-constructor function, and if that scope is not global.
      const outerFunction = fullScope.self.signifier?.getTypeByKind('Function');
      container =
        isStatic && !outerFunction?.isConstructor
          ? fullScope.local
          : (fullScope.self as WithableType);
    }

    return assignVariable(this, { name, range, container }, rhs, {
      static: isStatic,
      docs,
      ctx,
    });
  }

  override structLiteral(
    children: StructLiteralCstChildren,
    ctx: VisitorContext,
  ): Type<'Struct'> {
    // We may already have a struct type attached to a signfier,
    // which should be updated instead of replaced.
    const structFromDocs =
      ctx.docs?.type[0]?.kind === 'Struct'
        ? (ctx.docs?.type[0] as StructType)
        : undefined;
    const struct =
      ctx.signifier?.getTypeByKind('Struct') ||
      structFromDocs ||
      this.PROCESSOR.createStruct(children.StartBrace[0], children.EndBrace[0]);
    ctx.signifier?.setType(struct);
    ctx.signifier = undefined;
    ctx.docs = undefined;

    // TODO
    // // If we are creating a struct literal to match a doc-described
    // // struct, we should *extend* that underlying struct so we don't
    // // mutate the parent (and so we can differientiate between)
    // if (structFromDocs) {
    //   struct = structFromDocs.derive();
    // }

    // Create the newMember ranges, to help with autocompletes
    const sortedParts = sortChildren(children);
    let nextRange: StructNewMemberRange | undefined;
    for (let i = 0; i < sortedParts.length; i++) {
      const part = sortedParts[i];
      const isStart = 'image' in part && [',', '{'].includes(part.image);
      if (isStart) {
        // Then we're starting a range!
        const startPosition = Position.fromCstEnd(this.PROCESSOR.file, part);
        // Loop through the next parts until we find
        nextRange = new StructNewMemberRange(struct, startPosition);
      } else if (nextRange) {
        const endPosition = Position.fromCstStart(
          this.PROCESSOR.file,
          'image' in part ? part : part.location!,
        );
        nextRange.end = endPosition;
        this.PROCESSOR.file.addStructNewMemberRange(nextRange);
        nextRange = undefined;
      }
    }

    // Manage the struct members
    // The self-scope remains unchanged for struct literals!
    for (const entry of children.structLiteralEntry || []) {
      const parts = entry.children;
      // Visit the JSDocs, if there are any
      if (parts.jsdoc) {
        this.visit(parts.jsdoc, ctx);
      }
      const docs = this.PROCESSOR.consumeJsdoc();
      // The name is either a direct variable name or a string literal.
      let name: string;
      let range: Range;
      if (parts.Identifier) {
        name = parts.Identifier[0].image;
        range = this.PROCESSOR.range(parts.Identifier[0]);
      } else {
        name = stringLiteralAsString(parts.stringLiteral![0].children);
        range = this.PROCESSOR.range(
          parts.stringLiteral![0].children.StringStart[0],
          parts.stringLiteral![0].children.StringEnd[0],
        );
      }
      if (parts.assignmentRightHandSide) {
        assignVariable(
          this,
          { name, range, container: struct },
          parts.assignmentRightHandSide,
          { docs, ctx, instance: true },
        );
      } else {
        // Then we're in short-hand mode, where the RHS has the same
        // name but refers to a local variable.
        const matchingVariable = this.FIND_ITEM_BY_NAME(name);
        if (!matchingVariable) {
          // Add an error message
          this.PROCESSOR.addDiagnostic(
            'INVALID_OPERATION',
            parts.Identifier![0],
            `Struct literal shorthand requires an existing variable named "${name}"`,
          );
        } else {
          struct.addMember(matchingVariable, { override: true })!;
          matchingVariable.addRef(range);
        }
      }
    }
    return struct;
  }

  /**
   * Fallback identifier handler. Figure out what a given
   * identifier is referencing, and create appropriate references
   * to make that work.*/
  override identifier(
    children: IdentifierCstChildren,
  ): { item: Signifier; ref: Reference } | undefined {
    const item = this.FIND_ITEM(children);
    if (item) {
      const ref = (item.item as Signifier).addRef(item.range);
      return {
        item: item.item as Signifier,
        ref,
      };
    }
    return;
  }

  //#region LITERALS and TYPES
  override assignmentRightHandSide(
    children: AssignmentRightHandSideCstChildren,
    context: VisitorContext,
  ): (Type | TypeStore)[] {
    if (children.expression) {
      return this.expression(children.expression[0].children, context);
    } else if (children.structLiteral) {
      return [this.structLiteral(children.structLiteral[0].children, context)];
    } else if (children.functionExpression) {
      return [
        this.functionExpression(
          children.functionExpression[0].children,
          context,
        ) || this.ANY,
      ];
    }
    return [this.ANY];
  }

  override expression(
    children: ExpressionCstChildren,
    context: VisitorContext,
  ): (Type | TypeStore)[] {
    const lhs = this.primaryExpression(
      children.primaryExpression[0].children,
      context,
    );
    if (children.binaryExpression) {
      // TODO: Check the rhs type and the operator and emit a diagnostic if needed. For now just return the lhs since any operator shouldn't change the type.
      this.assignmentRightHandSide(
        children.binaryExpression[0].children.assignmentRightHandSide[0]
          .children,
        context,
      );
      const operator =
        children.binaryExpression[0].children.BinaryOperator[0].image;
      const isNumeric = operator.match(/^([*/%^&|-]|<<|>>)$/);
      const isBoolean =
        !isNumeric && operator.match(/^([><]=?|\|\||&&|!=|==)$/);
      if (isNumeric) {
        return [this.REAL];
      } else if (isBoolean) {
        return [this.BOOLEAN];
      } else {
        return lhs;
      }
    } else if (children.ternaryExpression) {
      // Get the types of the two expression and create a union
      const ternary =
        children.ternaryExpression[0].children.assignmentRightHandSide;
      const leftType = this.assignmentRightHandSide(
        ternary[0].children,
        context,
      );
      const rightType = this.assignmentRightHandSide(
        ternary[1].children,
        context,
      );
      return [...arrayWrapped(leftType), ...arrayWrapped(rightType)];
    } else if (children.assignment) {
      // We shouldn't really end up here since well-formed code
      // should have assignments that get caught by other rules.
      return [this.ANY];
    }
    return lhs; // Shouldn't happpen unless the parser gets changed.
  }

  override primaryExpression(
    children: PrimaryExpressionCstChildren,
    context: VisitorContext,
  ): (Type | TypeStore)[] {
    let type!: Type | (Type | TypeStore)[];
    if (children.BooleanLiteral) {
      type = new Type('Bool');
    } else if (children.NumericLiteral) {
      type = new Type('Real');
    } else if (children.NaN) {
      type = new Type('Real');
    } else if (children.PointerLiteral) {
      type = new Type('Pointer');
    } else if (children.Undefined) {
      type = new Type('Undefined');
    } else if (children.arrayLiteral) {
      type = this.arrayLiteral(children.arrayLiteral[0].children, context);
    } else if (children.identifierAccessor) {
      type = this.identifierAccessor(
        children.identifierAccessor[0].children,
        context,
      );
    } else if (children.stringLiteral) {
      type = this.stringLiteral(children.stringLiteral[0].children, context);
    } else if (children.multilineDoubleStringLiteral) {
      type = this.multilineDoubleStringLiteral(
        children.multilineDoubleStringLiteral[0].children,
        context,
      );
    } else if (children.multilineSingleStringLiteral) {
      type = this.multilineSingleStringLiteral(
        children.multilineSingleStringLiteral[0].children,
        context,
      );
    } else if (children.templateLiteral) {
      type = this.templateLiteral(
        children.templateLiteral[0].children,
        context,
      );
    } else if (children.parenthesizedExpression) {
      type = this.parenthesizedExpression(
        children.parenthesizedExpression[0].children,
        context,
      );
    }
    if (!type) {
      logger.warn('No type found for primary expression');
    }
    type ||= this.ANY;
    // Override the type if we have a unary operator

    const prefixOperator = children.UnaryPrefixOperator?.[0].image;
    if (prefixOperator?.match(/^[~+-]|\+\+|--$/)) {
      type = this.REAL;
    } else if (prefixOperator?.match(/^!$/)) {
      type = this.BOOLEAN;
    }

    return arrayWrapped(type);
  }

  override parenthesizedExpression(
    children: ParenthesizedExpressionCstChildren,
    context: VisitorContext,
  ): (Type | TypeStore)[] {
    return this.expression(children.expression[0].children, context);
  }

  override stringLiteral(
    children: StringLiteralCstChildren,
    context: VisitorContext,
  ): Type<'String'> {
    return new Type('String');
  }
  override multilineDoubleStringLiteral(
    children: MultilineDoubleStringLiteralCstChildren,
    context: VisitorContext,
  ): Type<'String'> {
    return new Type('String');
  }

  override multilineSingleStringLiteral(
    children: MultilineSingleStringLiteralCstChildren,
    context: VisitorContext,
  ): Type<'String'> {
    return new Type('String');
  }

  override templateLiteral(
    children: TemplateLiteralCstChildren,
    context: VisitorContext,
  ): Type<'String'> {
    // Make sure that the code content is still visited
    for (const exp of children.expression || []) {
      this.expression(exp.children, withCtxKind(context, 'template'));
    }
    return new Type('String');
  }

  override arrayLiteral(
    children: ArrayLiteralCstChildren,
    ctx: VisitorContext,
  ): Type<'Array'> {
    // Infer the content type of the array
    // Make sure that the content is visited
    const types: Type[] = [];
    const arrayType = new Type('Array');
    for (const item of children.assignmentRightHandSide || []) {
      const itemTypes = this.assignmentRightHandSide(
        item.children,
        withCtxKind(ctx, 'arrayMember'),
      );
      for (const itemType of getTypes(itemTypes)) {
        if (
          !types.find(
            (t) => t.kind === itemType.kind && t.name === itemType.name,
          )
        ) {
          types.push(itemType);
          arrayType.addItemType(itemType);
        }
      }
    }
    if (ctx.signifier) {
      ctx.signifier.setType(ctx.docs?.type || arrayType);
    }
    return arrayType;
  }

  //#endregion
}
