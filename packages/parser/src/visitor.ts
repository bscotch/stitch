// CST Visitor for creating an AST etc
import { arrayWrapped } from '@bscotch/utility';
import type { CstNode } from 'chevrotain';
import type {
  ArrayLiteralCstChildren,
  AssignmentRightHandSideCstChildren,
  ExpressionCstChildren,
  FunctionExpressionCstChildren,
  FunctionStatementCstChildren,
  IdentifierAccessorCstChildren,
  IdentifierCstChildren,
  JsdocGmlCstChildren,
  JsdocJsCstChildren,
  LocalVarDeclarationCstChildren,
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
import { JsdocSummary, parseJsdoc } from './jsdoc.js';
import { logger } from './logger.js';
import {
  GmlVisitorBase,
  VisitorContext,
  identifierFrom,
  stringLiteralAsString,
  withCtxKind,
} from './parser.js';
import type { Code } from './project.code.js';
import { Range, Reference } from './project.location.js';
import { Signifier } from './signifiers.js';
import { getTypeOfKind, getTypes, isTypeOfKind } from './types.checks.js';
import { typeFromParsedJsdocs } from './types.feather.js';
import { EnumType, Type, TypeStore, type StructType } from './types.js';
import { assert } from './util.js';
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
  } catch (error) {
    logger.error(error);
  }
}

export class GmlSignifierVisitor extends GmlVisitorBase {
  static validated = false;
  constructor(readonly PROCESSOR: SignifierProcessor) {
    super();
    this.validateVisitor();
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

  protected FIND_ITEM_BY_NAME(name: string): Signifier | undefined {
    const scope = this.PROCESSOR.fullScope;
    return (
      scope.local.getMember(name) ||
      (!scope.selfIsGlobal && scope.self.getMember(name)) ||
      this.PROCESSOR.globalSelf.getMember(name)
    );
  }

  /** Given an identifier in the current scope, find the corresponding item. */
  protected FIND_ITEM(
    children: IdentifierCstChildren,
  ): { item: Signifier | StructType | EnumType; range: Range } | undefined {
    const identifier = identifierFrom(children);
    if (!identifier) {
      return;
    }
    const scope = this.PROCESSOR.fullScope;
    let item: Signifier | StructType | EnumType | undefined;
    const range = this.PROCESSOR.range(identifier.token);
    switch (identifier.type) {
      case 'Global':
        // Global is a special case, it's a keyword and also
        // a globalvar.
        item = scope.global;
        break;
      case 'Self':
        // Then we're reference our current self context
        item = scope.self;
        // If this self scope is also global, emit a diagnostic
        // (should not use self to refer to global)
        if (scope.selfIsGlobal) {
          this.PROCESSOR.addDiagnostic(
            'GLOBAL_SELF',
            children.Self![0],
            '`self` refers to the global scope here, which is probably unintentional.',
          );
        }
        break;
      default:
        const { name } = identifier;
        item = this.FIND_ITEM_BY_NAME(name);
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

  get UNDEFINED() {
    return new Type('Undefined');
  }

  /**
   * Given parsed JSDocs, convert into a Type and store
   * it for use by the next symbol.
   */
  PREPARE_JSDOC(jsdoc: JsdocSummary) {
    const type = typeFromParsedJsdocs(jsdoc, this.PROCESSOR.project.types);
    this.PROCESSOR.unusedJsdoc = {
      jsdoc,
      type,
    };
  }

  override jsdocJs(children: JsdocJsCstChildren) {
    this.PREPARE_JSDOC(parseJsdoc(children.JsdocJs[0]));
  }

  override jsdocGml(children: JsdocGmlCstChildren) {
    this.PREPARE_JSDOC(parseJsdoc(children.JsdocGmlLine));
  }

  override withStatement(
    children: WithStatementCstChildren,
    context: VisitorContext,
  ) {
    // With statements change the self scope to
    // whatever their expression evaluates to.
    // Evaluate the expression and try to use its type as the self scope
    const docs = this.PROCESSOR.consumeJsdoc();

    const conditionType = getTypeOfKind(
      this.expression(
        children.expression[0].children,
        withCtxKind(context, 'withCondition'),
      ),
      ['Struct', 'Asset.GMObject', 'Id.Instance'],
    );
    const blockLocation = children.blockableStatement[0].location!;

    // See if there are JSDocs providing more specific self context
    let self: StructType;
    if (docs?.jsdoc.kind === 'self' && isTypeOfKind(docs.type[0], 'Struct')) {
      self = docs.type[0];
    } else if (isTypeOfKind(conditionType, 'Struct')) {
      self = conditionType;
    } else if (
      (isTypeOfKind(conditionType, 'Asset.GMObject') ||
        isTypeOfKind(conditionType, 'Id.Instance')) &&
      conditionType.name
    ) {
      // Then we want to use the associated instance struct as the self
      const instanceStruct = this.PROCESSOR.project.getAssetByName(
        conditionType.name,
      )?.instanceType;
      if (instanceStruct) {
        self = instanceStruct;
      }
    }
    self ||= this.PROCESSOR.createStruct(blockLocation);

    this.PROCESSOR.scope.setEnd(children.expression[0].location!, true);
    this.PROCESSOR.pushSelfScope(blockLocation, self, false);

    this.visit(children.blockableStatement, withCtxKind(context, 'withBody'));

    this.PROCESSOR.scope.setEnd(blockLocation, true);
    this.PROCESSOR.popSelfScope(blockLocation, true);
    return;
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

  /** Static params are unambiguously defined. */
  override staticVarDeclarations(
    children: StaticVarDeclarationsCstChildren,
    ctx: VisitorContext,
  ) {
    const docs = this.PROCESSOR.consumeJsdoc();
    // Ensure that this variable exists
    const self = this.PROCESSOR.currentSelf;
    const range = this.PROCESSOR.range(children.Identifier[0]);
    const signifier = self
      .addMember(children.Identifier[0].image)
      .definedAt(range);
    signifier.addRef(range);
    signifier.static = true;
    signifier.instance = true;

    // Ensure that the type is up to date
    const assignedToFunction =
      children.assignmentRightHandSide?.[0].children.functionExpression?.[0]
        .children;
    const assignedToStructLiteral =
      !assignedToFunction &&
      children.assignmentRightHandSide?.[0].children.structLiteral?.[0]
        .children;

    if (assignedToFunction || assignedToStructLiteral) {
      ctx.signifier = signifier;
      ctx.docs = docs;
      if (assignedToFunction) {
        this.functionExpression(assignedToFunction, ctx);
      } else if (assignedToStructLiteral) {
        this.structLiteral(assignedToStructLiteral, ctx);
      }
    } else {
      const inferredType = this.assignmentRightHandSide(
        children.assignmentRightHandSide[0].children,
        withCtxKind(ctx, 'assignment'),
      );

      if (docs) {
        signifier.describe(docs.jsdoc.description);
        signifier.setType(docs.type);
      } else if (inferredType) {
        signifier.setType(inferredType);
      }
    }
  }

  override localVarDeclaration(
    children: LocalVarDeclarationCstChildren,
    ctx: VisitorContext,
  ) {
    const docs = this.PROCESSOR.consumeJsdoc();
    const local = this.PROCESSOR.currentLocalScope;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    // Ensure that this variable exists
    const signifier = local
      .addMember(children.Identifier[0].image)
      .definedAt(range);
    signifier.local = true;
    signifier.addRef(range);

    // Ensure that the type is up to date
    const assignedToFunction =
      children.assignmentRightHandSide?.[0].children.functionExpression?.[0]
        .children;
    const assignedToStructLiteral =
      !assignedToFunction &&
      children.assignmentRightHandSide?.[0].children.structLiteral?.[0]
        .children;

    if (assignedToFunction || assignedToStructLiteral) {
      ctx.signifier = signifier;
      ctx.docs = docs;
      if (assignedToFunction) {
        this.functionExpression(assignedToFunction, ctx);
      } else if (assignedToStructLiteral) {
        this.structLiteral(assignedToStructLiteral, ctx);
      }
    } else {
      const inferredType = children.assignmentRightHandSide
        ? this.assignmentRightHandSide(
            children.assignmentRightHandSide[0].children,
            withCtxKind(ctx, 'assignment'),
          )
        : new Type('Any');

      if (docs) {
        signifier.describe(docs.jsdoc.description);
        signifier.setType(docs.type);
      } else if (inferredType) {
        signifier.setType(inferredType);
      }
    }
  }

  override variableAssignment(
    children: VariableAssignmentCstChildren,
    ctx: VisitorContext,
  ) {
    const docs = this.PROCESSOR.consumeJsdoc();
    // See if this identifier is known.
    const identified = this.FIND_ITEM(children);
    let signifier = identified?.item as Signifier | undefined;
    const name = children.Identifier[0].image;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    let wasUndeclared = false;
    if (!signifier) {
      wasUndeclared = true;
      // Create a new member on the self scope, unless it's global
      const fullScope = this.PROCESSOR.fullScope;
      if (fullScope.self !== fullScope.global) {
        // Then we can add a new member
        signifier = fullScope.self.addMember(name).definedAt(range);
        signifier.addRef(range);
        signifier.instance = true;
      } else {
        this.PROCESSOR.addDiagnostic(
          'UNDECLARED_GLOBAL_REFERENCE',
          children.Identifier[0],
          `${children.Identifier[0].image} is not declared anywhere.`,
        );
      }
    } else {
      // Add a reference to the item.
      signifier.addRef(range);
      // If this is the first time we've seen it, and it wouldn't have
      // an unambiguous declaration, add its definition
      if (!signifier.def) {
        wasUndeclared = true;
        signifier.definedAt(range);
      }
    }

    // If we don't have any type on this signifier yet, use the
    // assigned type.
    const assignedToFunction =
      children.assignmentRightHandSide?.[0].children.functionExpression?.[0]
        .children;
    const assignedToStructLiteral =
      !assignedToFunction &&
      children.assignmentRightHandSide?.[0].children.structLiteral?.[0]
        .children;

    if (assignedToFunction || assignedToStructLiteral) {
      ctx.signifier = signifier;
      ctx.docs = docs;
      if (assignedToFunction) {
        this.functionExpression(assignedToFunction, ctx);
      } else if (assignedToStructLiteral) {
        this.structLiteral(assignedToStructLiteral, ctx);
      }
    } else {
      const inferredType = this.assignmentRightHandSide(
        children.assignmentRightHandSide[0].children,
        withCtxKind(ctx, 'assignment'),
      );
      if (signifier && (!signifier.isTyped || wasUndeclared)) {
        if (docs) {
          signifier.describe(docs.jsdoc.description);
          signifier.setType(docs.type);
        } else if (inferredType) {
          signifier.setType(inferredType);
        }
      }
    }
  }

  /**
   * Fallback identifier handler. Figure out what a given
   * identifier is referencing, and create appropriate references
   * to make that work.*/
  override identifier(
    children: IdentifierCstChildren,
  ): { item: Signifier; ref: Reference<Signifier> } | undefined {
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
        ),
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
      return lhs;
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
    assert(type, 'No type found for primary expression');
    // TODO: Check unary operators etc to make sure types make sense
    return arrayWrapped(type);
  }

  override parenthesizedExpression(
    children: ParenthesizedExpressionCstChildren,
    context: VisitorContext,
  ): (Type | TypeStore)[] {
    return this.expression(children.expression[0].children, context);
  }

  override structLiteral(
    children: StructLiteralCstChildren,
    ctx: VisitorContext,
  ): Type<'Struct'> {
    // We may already have a struct type attached to a signfier,
    // which should be updated instaed of replaced.
    const structType = ctx.signifier?.getTypeByKind('Struct');
    const struct =
      structType ||
      this.PROCESSOR.createStruct(children.StartBrace[0], children.EndBrace[0]);
    ctx.signifier?.setType(struct);
    ctx.signifier = undefined;
    ctx.docs = undefined;

    // Change the self scope to the struct
    this.PROCESSOR.scope.setEnd(children.StartBrace[0], false);
    this.PROCESSOR.pushSelfScope(children.StartBrace[0], struct, true);
    for (const entry of children.structLiteralEntry || []) {
      const docs = this.PROCESSOR.consumeJsdoc();
      const parts = entry.children;
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
      // Ensure the member exists
      const signifier = struct.addMember(name).definedAt(range);
      signifier.instance = true;
      signifier.addRef(range);

      // Parse any Jsdocs
      if (parts.jsdoc) {
        this.visit(parts.jsdoc, ctx);
      }

      const assignedToFunction =
        parts.assignmentRightHandSide?.[0].children.functionExpression?.[0]
          .children;
      const assignedToStructLiteral =
        !assignedToFunction &&
        parts.assignmentRightHandSide?.[0].children.structLiteral?.[0].children;

      if (assignedToFunction || assignedToStructLiteral) {
        ctx.signifier = signifier;
        ctx.docs = docs;
        if (assignedToFunction) {
          this.functionExpression(assignedToFunction, ctx);
        } else if (assignedToStructLiteral) {
          this.structLiteral(assignedToStructLiteral, ctx);
        }
      } else {
        const inferredType = parts.assignmentRightHandSide
          ? this.assignmentRightHandSide(
              parts.assignmentRightHandSide[0].children,
              withCtxKind(ctx, 'assignment'),
            )
          : this.ANY;
        if (docs) {
          signifier.describe(docs.jsdoc.description);
          signifier.setType(docs.type);
        } else if (inferredType) {
          signifier.setType(inferredType);
        }
      }
    }

    this.PROCESSOR.scope.setEnd(children.EndBrace[0], false);
    this.PROCESSOR.popSelfScope(children.EndBrace[0], true);
    return struct;
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
    return arrayType;
  }

  //#endregion
}
