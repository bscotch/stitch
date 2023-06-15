// CST Visitor for creating an AST etc
import type { CstNode } from 'chevrotain';
import type {
  ArrayLiteralCstChildren,
  AssignmentRightHandSideCstChildren,
  ExpressionCstChildren,
  FunctionExpressionCstChildren,
  IdentifierAccessorCstChildren,
  IdentifierCstChildren,
  JsdocGmlCstChildren,
  JsdocJsCstChildren,
  LocalVarDeclarationCstChildren,
  MultilineDoubleStringLiteralCstChildren,
  MultilineSingleStringLiteralCstChildren,
  ParenthesizedExpressionCstChildren,
  PrimaryExpressionCstChildren,
  StaticVarDeclarationsCstChildren,
  StringLiteralCstChildren,
  StructLiteralCstChildren,
  TemplateLiteralCstChildren,
  VariableAssignmentCstChildren,
  WithStatementCstChildren,
} from '../gml-cst.js';
import { JsdocSummary, parseJsdoc } from './jsdoc.js';
import {
  GmlVisitorBase,
  identifierFrom,
  stringLiteralAsString,
} from './parser.js';
import type { Code } from './project.code.js';
import {
  Range,
  Reference,
  type ReferenceableType,
} from './project.location.js';
import { isTypeOfKind } from './types.checks.js';
import { Type, type StructType } from './types.js';
import { assert } from './util.js';
import { visitFunctionExpression } from './visitor.functionExpression.js';
import { visitIdentifierAccessor } from './visitor.identifierAccessor.js';
import { SymbolProcessor } from './visitor.processor.js';

export function processSymbols(file: Code) {
  const processor = new SymbolProcessor(file);
  const visitor = new GmlSymbolVisitor(processor);
  visitor.FIND_SYMBOLS(file.cst);
}

export class GmlSymbolVisitor extends GmlVisitorBase {
  static validated = false;
  constructor(readonly PROCESSOR: SymbolProcessor) {
    super();
    this.validateVisitor();
  }

  /** Entrypoint */
  FIND_SYMBOLS(input: CstNode) {
    this.visit(input);
    this.PROCESSOR.setLastScopeEnd(input.location!);
    return this.PROCESSOR;
  }

  protected FIND_ITEM_BY_NAME(name: string): ReferenceableType | undefined {
    const scope = this.PROCESSOR.fullScope;
    return (
      scope.local.getMember(name) ||
      (!scope.selfIsGlobal && scope.self.getMember(name)) ||
      this.PROCESSOR.project.getGlobal(name)?.symbol
    );
  }

  /** Given an identifier in the current scope, find the corresponding item. */
  protected FIND_ITEM(
    children: IdentifierCstChildren,
  ): { item: ReferenceableType; range: Range } | undefined {
    const identifier = identifierFrom(children);
    if (!identifier) {
      return;
    }
    const scope = this.PROCESSOR.fullScope;
    let item: ReferenceableType | undefined;
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

  get UNKNOWN() {
    return this.PROCESSOR.project.createType('Unknown');
  }

  /**
   * Given a type, cohsume any current JSDocs and compute
   * the combined type. May return the original type (+/- mutation)
   * or a new type, depending on the scenario.
   */
  UPDATED_TYPE_WITH_DOCS(type: Type) {
    const docs = this.PROCESSOR.useJsdoc();
    if (!docs || docs.jsdoc.kind === 'self') {
      return type;
    }
    type.description = docs.type.description || type.description;
    if (docs.jsdoc.kind === 'description') {
      return type;
    }
    // If the type is narrower (or the same as) the docs, return the docs
    // (i.e. the docs get precedence when there is no conflict).
    if (type.narrows(docs.type)) {
      return docs.type;
    }
    // Otherwise merge the two types
    // TODO: Handle conflict between docs and type
    return Type.merge(type, docs.type);
  }

  override withStatement(children: WithStatementCstChildren) {
    // With statements change the self scope to
    // whatever their expression evaluates to.
    // Evaluate the expression and try to use its type as the self scope
    const conditionType = this.expression(children.expression[0].children);
    const blockLocation = children.blockableStatement[0].location!;

    const docs = this.PROCESSOR.useJsdoc();
    let self: StructType;
    if (docs?.jsdoc.kind === 'self' && isTypeOfKind(docs.type, 'Struct')) {
      self = docs.type;
    } else if (isTypeOfKind(conditionType, 'Struct')) {
      self = conditionType;
    } else if (
      isTypeOfKind(conditionType, 'Asset.GMObject') &&
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

    this.visit(children.blockableStatement);

    this.PROCESSOR.scope.setEnd(blockLocation, true);
    this.PROCESSOR.popSelfScope(blockLocation, true);
    return;
  }

  /**
   * Given parsed JSDocs, convert into a Type and store
   * it for use by the next symbol.
   */
  PREPARE_JSDOC(jsdoc: JsdocSummary) {
    const type = Type.fromParsedJsdocs(jsdoc, this.PROCESSOR.project.types);
    // There might be named types we can swap out.
    if (type.context && type.context.name) {
      const matchingItem = this.FIND_ITEM_BY_NAME(type.context.name);
      if (matchingItem) {
        const contextType =
          'type' in matchingItem ? matchingItem.type : matchingItem;
        if (contextType.kind === 'Struct') {
          type.context = contextType as StructType;
        }
      }
    }
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

  override functionExpression(
    children: FunctionExpressionCstChildren,
  ): Type<'Function'> {
    return visitFunctionExpression.call(this, children);
  }

  /** Called on *naked* identifiers and those that have accessors/suffixes of various sorts. */
  override identifierAccessor(children: IdentifierAccessorCstChildren): Type {
    return visitIdentifierAccessor.call(this, children);
  }

  /** Static params are unambiguously defined. */
  override staticVarDeclarations(children: StaticVarDeclarationsCstChildren) {
    // Add to the self scope.
    const self = this.PROCESSOR.currentSelf;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    const type = this.UPDATED_TYPE_WITH_DOCS(
      this.assignmentRightHandSide(
        children.assignmentRightHandSide[0].children,
      ) || this.UNKNOWN,
    );

    const member = self
      .addMember(children.Identifier[0].image, type)
      .definedAt(range);
    member.addRef(range);
    member.static = true;
    member.instance = true;
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    const local = this.PROCESSOR.currentLocalScope;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    const type = this.UPDATED_TYPE_WITH_DOCS(
      children.assignmentRightHandSide
        ? this.assignmentRightHandSide(
            children.assignmentRightHandSide[0].children,
          )
        : this.UNKNOWN,
    );

    const member = local
      .addMember(children.Identifier[0].image, type)
      .definedAt(range);
    member.local = true;
    member.addRef(range);
  }

  override variableAssignment(children: VariableAssignmentCstChildren) {
    // See if this identifier is known.
    const identified = this.identifier(children);
    const name = children.Identifier[0].image;
    const item = identified?.item;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    const assignedType = this.UPDATED_TYPE_WITH_DOCS(
      this.assignmentRightHandSide(
        children.assignmentRightHandSide[0].children,
      ),
    );

    if (!item) {
      // Create a new member on the self scope, unless it's global
      const fullScope = this.PROCESSOR.fullScope;
      if (fullScope.self !== fullScope.global) {
        // Then we can add a new member
        const member = fullScope.self
          .addMember(name, assignedType)
          .definedAt(range);
        member.addRef(range);
        member.instance = true;
      } else {
        // TODO: Add a diagnostic
      }
    } else {
      item.def ||= range;
      item.addRef(range, assignedType);
    }
  }

  /**
   * Fallback identifier handler. Figure out what a given
   * identifier is referencing, and create appropriate references
   * to make that work.*/
  override identifier(
    children: IdentifierCstChildren,
  ): { item: ReferenceableType; ref: Reference } | undefined {
    const item = this.FIND_ITEM(children);
    if (item) {
      const ref = item.item.addRef(item.range);
      return {
        item: item.item,
        ref,
      };
    }
    return;
  }

  //#region LITERALS and TYPES
  override assignmentRightHandSide(
    children: AssignmentRightHandSideCstChildren,
  ): Type {
    if (children.expression) {
      return this.expression(children.expression[0].children);
    } else if (children.structLiteral) {
      return this.structLiteral(children.structLiteral[0].children);
    } else if (children.functionExpression) {
      return this.functionExpression(children.functionExpression[0].children);
    }
    return this.UNKNOWN;
  }

  override expression(children: ExpressionCstChildren): Type {
    const lhs = this.primaryExpression(children.primaryExpression[0].children);
    if (children.binaryExpression) {
      // TODO: Check the rhs type and the operator and emit a diagnostic if needed. For now just return the lhs since any operator shouldn't change the type.
      this.assignmentRightHandSide(
        children.binaryExpression[0].children.assignmentRightHandSide[0]
          .children,
      );
      return lhs;
    } else if (children.ternaryExpression) {
      // Get the types of the two expression and create a union
      const ternary =
        children.ternaryExpression[0].children.assignmentRightHandSide;
      const leftType = this.assignmentRightHandSide(ternary[0].children);
      const rightType = this.assignmentRightHandSide(ternary[1].children);
      return Type.merge(leftType, rightType);
    } else if (children.assignment) {
      // We shouldn't really end up here since well-formed code
      // should have assignments that get caught by other rules.
      return this.PROCESSOR.project.createType('Undefined');
    }
    return lhs; // Shouldn't happpen unless the parser gets changed.
  }

  override primaryExpression(children: PrimaryExpressionCstChildren): Type {
    let type!: Type;
    if (children.BooleanLiteral) {
      type = this.PROCESSOR.project.createType('Bool');
    } else if (children.NumericLiteral) {
      type = this.PROCESSOR.project.createType('Real');
    } else if (children.NaN) {
      type = this.PROCESSOR.project.createType('Real');
    } else if (children.PointerLiteral) {
      type = this.PROCESSOR.project.createType('Pointer');
    } else if (children.Undefined) {
      type = this.PROCESSOR.project.createType('Undefined');
    } else if (children.arrayLiteral) {
      type = this.arrayLiteral(children.arrayLiteral[0].children);
    } else if (children.identifierAccessor) {
      type = this.identifierAccessor(children.identifierAccessor[0].children);
    } else if (children.stringLiteral) {
      type = this.stringLiteral(children.stringLiteral[0].children);
    } else if (children.multilineDoubleStringLiteral) {
      type = this.multilineDoubleStringLiteral(
        children.multilineDoubleStringLiteral[0].children,
      );
    } else if (children.multilineSingleStringLiteral) {
      type = this.multilineSingleStringLiteral(
        children.multilineSingleStringLiteral[0].children,
      );
    } else if (children.templateLiteral) {
      type = this.templateLiteral(children.templateLiteral[0].children);
    } else if (children.parenthesizedExpression) {
      type = this.parenthesizedExpression(
        children.parenthesizedExpression[0].children,
      );
    }
    assert(type, 'No type found for primary expression');
    // TODO: Check unary operators etc to make sure types make sense
    return type;
  }

  override parenthesizedExpression(
    children: ParenthesizedExpressionCstChildren,
  ): Type {
    return this.expression(children.expression[0].children);
  }

  override structLiteral(children: StructLiteralCstChildren): Type<'Struct'> {
    const struct = this.PROCESSOR.createStruct(
      children.StartBrace[0],
      children.EndBrace[0],
    );

    // Change the self scope to the struct
    this.PROCESSOR.scope.setEnd(children.StartBrace[0], false);
    this.PROCESSOR.pushSelfScope(children.StartBrace[0], struct, true);
    for (const entry of children.structLiteralEntry || []) {
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
      if (parts.jsdoc) {
        this.visit(parts.jsdoc);
      }
      if (parts.assignmentRightHandSide) {
        const type = this.UPDATED_TYPE_WITH_DOCS(
          this.assignmentRightHandSide(
            parts.assignmentRightHandSide[0].children,
          ),
        );
        if (type instanceof Type) {
          const member = struct.addMember(name, type).definedAt(range);
          member.instance = true;
          member.addRef(range);
        }
      }
    }

    this.PROCESSOR.scope.setEnd(children.EndBrace[0], false);
    this.PROCESSOR.popSelfScope(children.EndBrace[0], true);
    return struct;
  }
  override stringLiteral(children: StringLiteralCstChildren): Type<'String'> {
    return this.PROCESSOR.project.createType('String');
  }
  override multilineDoubleStringLiteral(
    children: MultilineDoubleStringLiteralCstChildren,
  ): Type<'String'> {
    return this.PROCESSOR.project.createType('String');
  }
  override multilineSingleStringLiteral(
    children: MultilineSingleStringLiteralCstChildren,
  ): Type<'String'> {
    return this.PROCESSOR.project.createType('String');
  }
  override templateLiteral(
    children: TemplateLiteralCstChildren,
  ): Type<'String'> {
    // Make sure that the code content is still visited
    if (children.expression) {
      this.visit(children.expression);
    }
    return this.PROCESSOR.project.createType('String');
  }
  override arrayLiteral(children: ArrayLiteralCstChildren): Type<'Array'> {
    // Infer the content type of the array
    // Make sure that the content is visited
    const types: Type[] = [];
    const arrayType = this.PROCESSOR.project.createType('Array');
    for (const item of children.assignmentRightHandSide || []) {
      const type = this.assignmentRightHandSide(item.children);
      if (!types.find((t) => t.kind === type.kind && t.name === type.name)) {
        types.push(type);
        arrayType.addItemType(type);
      }
    }
    return arrayType;
  }

  //#endregion
}
