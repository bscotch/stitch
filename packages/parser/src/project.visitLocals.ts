// CST Visitor for creating an AST etc
import type { CstNode, CstNodeLocation, IToken } from 'chevrotain';
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
  isEmpty,
  sortedAccessorSuffixes,
  sortedFunctionCallParts,
  stringLiteralAsString,
} from './parser.js';
import type { Code } from './project.code.js';
import type { Diagnostic } from './project.diagnostics.js';
import {
  FunctionArgRange,
  Position,
  Range,
  Reference,
  fixITokenLocation,
  getType,
  type ReferenceableType,
  type Scope,
} from './project.location.js';
import { Symbol } from './project.symbol.js';
import {
  FunctionType,
  Type,
  typeIs,
  type EnumType,
  type StructType,
  type TypeMember,
} from './project.type.js';
import { assert, ok } from './util.js';

export function processSymbols(file: Code) {
  const processor = new SymbolProcessor(file);
  const visitor = new GmlSymbolVisitor(processor);
  visitor.FIND_SYMBOLS(file.cst);
}

class SymbolProcessor {
  protected readonly localScopeStack: StructType[] = [];
  protected readonly selfStack: (StructType | EnumType)[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  public scope: Scope;
  readonly position: Position;
  readonly diagnostics: Diagnostic[] = [];
  public unusedJsdoc: { type: Type; jsdoc: JsdocSummary } | undefined;

  constructor(readonly file: Code) {
    this.scope = file.scopes[0];
    assert(
      this.scope,
      'SymbolProcessor constructor: File must have a global scope',
    );
    this.localScopeStack.push(this.scope.local);
    this.selfStack.push(this.scope.self);
    this.position = this.scope.start;
  }

  useJsdoc() {
    const docs = this.unusedJsdoc;
    this.unusedJsdoc = undefined;
    return docs;
  }

  /**
   * If a single node is provided, create a range from it.
   * If two are provided, use the start of the first and end
   * of the second to create the range.
   */
  range(loc: CstNodeLocation, endLoc?: CstNodeLocation) {
    const start = this.position.at(loc);
    const end = this.position.atEnd(endLoc || loc);
    return new Range(start, end);
  }

  addDiagnostic(
    where: CstNodeLocation,
    message: string,
    severity: Diagnostic['severity'] = 'warning',
  ) {
    this.diagnostics.push({
      $tag: 'diagnostic',
      kind: 'parser',
      message,
      severity,
      location: Range.fromCst(this.file, where),
    });
  }

  get fullScope() {
    return {
      local: this.currentLocalScope,
      self: this.currentSelf,
      global: this.project.self,
      selfIsGlobal: this.currentSelf === this.project.self,
    };
  }

  get asset() {
    return this.file.asset;
  }

  get project() {
    return this.asset.project;
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  get currentSelf() {
    return this.selfStack.at(-1) || this.project.self;
  }

  getGlobalSymbol(name: string) {
    return this.project.getGlobal(name);
  }

  protected nextScope(token: CstNodeLocation, fromTokenEnd: boolean) {
    this.scope = this.scope.createNext(token, fromTokenEnd);
    this.file.scopes.push(this.scope);
    return this.scope;
  }

  /**
   * After parsing the entire file, the last scope might not
   * have an appropriate end position. Set it here!
   */
  setLastScopeEnd(rootNode: CstNodeLocation) {
    const lastScope = this.file.scopes.at(-1)!;
    lastScope.end = this.scope.end.atEnd(rootNode);
    if (lastScope.end.offset < lastScope.start.offset) {
      lastScope.end = lastScope.start;
    }
  }

  createStruct(token: CstNodeLocation, endToken?: CstNodeLocation) {
    return new Type('Struct').definedAt(this.range(token, endToken));
  }

  pushScope(
    startToken: CstNodeLocation,
    self: StructType | EnumType,
    fromTokenEnd: boolean,
  ) {
    const localScope = this.createStruct(startToken);
    this.localScopeStack.push(localScope);
    this.nextScope(startToken, fromTokenEnd).local = localScope;
    this.selfStack.push(self);
    this.scope.self = self;
  }

  popScope(
    nextScopeToken: CstNodeLocation,
    nextScopeStartsFromTokenEnd: boolean,
  ) {
    this.localScopeStack.pop();
    this.selfStack.pop();
    this.nextScope(nextScopeToken, nextScopeStartsFromTokenEnd).local =
      this.currentLocalScope;
    this.scope.self = this.currentSelf;
  }

  pushSelfScope(
    startToken: CstNodeLocation,
    self: StructType | EnumType,
    fromTokenEnd: boolean,
    options?: { accessorScope?: boolean },
  ) {
    this.selfStack.push(self);
    const nextScope = this.nextScope(startToken, fromTokenEnd);
    nextScope.self = self;
    if (options?.accessorScope) {
      nextScope.isDotAccessor = true;
    }
  }

  popSelfScope(
    nextScopeToken: CstNodeLocation,
    nextScopeStartsFromTokenEnd: boolean,
  ) {
    this.selfStack.pop();
    this.nextScope(nextScopeToken, nextScopeStartsFromTokenEnd).self =
      this.currentSelf;
  }
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
        break;
      case 'Identifier':
        const { name } = identifier;
        item = this.FIND_ITEM_BY_NAME(name);
        break;
      default:
        // TODO: Handle `other` and `all` keywords
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

  UPDATE_TYPE_WITH_DOCS(type: Type) {
    const docs = this.PROCESSOR.useJsdoc();
    if (!docs || docs.jsdoc.kind === 'self') {
      return type;
    }
    type.description = docs.type.description || type.description;
    if (docs.jsdoc.kind === 'description') {
      return type;
    }
    // TODO: Handle conflict between docs and type
    return Type.merge(type, docs.type);
  }

  override withStatement(children: WithStatementCstChildren) {
    // With statements change the self scope to
    // whatever their expression evaluates to.
    // TODO: Evaluate the expression and try to use its type as the self scope
    this.visit(children.expression);
    const blockLocation = children.blockableStatement[0].location!;

    const docs = this.PROCESSOR.useJsdoc();
    const self =
      docs?.jsdoc.kind === 'self' && docs.type.kind === 'Struct'
        ? (docs.type as StructType)
        : this.PROCESSOR.createStruct(blockLocation);

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
    // Get this identifier if we already have it.
    const identifier = this.identifier(children);
    // Consume the most recent jsdoc
    let docs = this.PROCESSOR.useJsdoc();
    if (!docs?.type.isFunction && docs?.type.kind !== 'Unknown') {
      // Then these docs are not applicable, so toss them.
      docs = undefined;
    }

    // Compute useful properties of this function to help figure out
    // how to define its symbol, type, scope, etc.
    let functionName: string | undefined = children.Identifier?.[0]?.image;
    const nameLocation = functionName
      ? this.PROCESSOR.range(children.Identifier![0])
      : undefined;
    const isConstructor = !!children.constructorSuffix;
    const functionTypeName = isConstructor ? 'Constructor' : 'Function';
    const bodyLocation = children.blockStatement[0].location!;

    // If this is global we should already have a symbol for it.
    // If not, we should create a new symbol.
    const item = (identifier?.item ||
      new Symbol(
        functionName || '',
        this.PROCESSOR.project.createType(functionTypeName).named(functionName),
      )) as Symbol | TypeMember;
    functionName = item.name;

    // Make sure we have a proper type
    if (item.type.kind === 'Unknown') {
      item.type.kind = functionTypeName;
    }
    const functionType = item.type as FunctionType;

    // Use JSDocs to fill in any missing top-level information
    ok(
      functionType.isFunction,
      `Expected function type, got ${functionType.kind}`,
    );
    functionType.describe(functionType.description || docs?.type.description);
    functionType.context =
      docs?.type.context?.kind === 'Struct'
        ? docs.type.context
        : (this.PROCESSOR.currentSelf as StructType);
    if (docs?.type.deprecated) {
      functionType.deprecated = docs.type.deprecated;
    }

    // Ensure that constructors have an attached constructed type
    if (isConstructor && !functionType.constructs) {
      functionType.constructs =
        this.PROCESSOR.createStruct(bodyLocation).named(functionName);
    }

    // Identify the "self" struct. If this is a constructor, "self" is the
    // constructed type. Otherwise, for now just create a new struct type
    // for the self scope.
    const self = (
      isConstructor ? functionType.constructs : functionType.context
    )!;

    // Make sure this function is a member of the self struct
    if (!self.getMember(functionName)) {
      const member = self.addMember(functionName, item.type);
      if (nameLocation) {
        member.definedAt(nameLocation);
        member.addRef(nameLocation);
      }
    }

    // Functions have their own localscope as well as their self scope,
    // so we need to push both.
    const startParen = fixITokenLocation(
      children.functionParameters[0].children.StartParen[0],
    );
    this.PROCESSOR.scope.setEnd(startParen);
    this.PROCESSOR.pushScope(startParen, self, true);
    const functionLocalScope = this.PROCESSOR.currentLocalScope;

    // TODO: Handle constructor extensions. The `constructs` type should
    // be based off of the parent.

    // Add function signature components. We may be *updating*, e.g.
    // if this was a global function and we're recomputing. So update
    // instead of just adding or even clearing-then-adding.
    const params =
      children.functionParameters?.[0]?.children.functionParameter || [];
    for (let i = 0; i < params.length; i++) {
      const param = params[i].children.Identifier[0];
      const range = this.PROCESSOR.range(param);

      // Use JSDocs to determine the type, description, etc of the parameter
      let fromJsdoc = docs?.type.getParameter(i);
      if (fromJsdoc && param.image !== fromJsdoc.name) {
        this.PROCESSOR.addDiagnostic(param, `Parameter name mismatch`);
        // Unset it so we don't accidentally use it!
        fromJsdoc = undefined;
      }
      const paramType = fromJsdoc?.type || this.UNKNOWN.definedAt(range);
      const optional = fromJsdoc?.optional || !!params[i].children.Assign;
      functionType
        .addParameter(i, param.image, paramType, optional)
        .definedAt(range);

      // Also add to the function's local scope.
      const member = functionLocalScope
        .addMember(param.image, paramType)
        .definedAt(range);
      member.addRef(range);
      member.local = true;
      member.parameter = true;
    }
    // If we have more args defined in JSDocs, add them!
    if ((docs?.type?.listParameters().length || 0) > params.length) {
      const extraParams = docs!.type.listParameters().slice(params.length);
      assert(extraParams, 'Expected extra params');
      for (let i = 0; i < extraParams.length; i++) {
        const idx = params.length + i;
        const param = extraParams[i];
        assert(param, 'Expected extra param');
        const paramType = param.type;
        const optional = param.optional;
        functionType.addParameter(idx, param.name, paramType, optional);
        // Do not add to local scope, since if it's only defined
        // in the JSDoc it's not a real parameter.
      }
    }

    // TODO: Remove any excess parameters, e.g. if we're updating a
    // prior definition. This is tricky since we may need to do something
    // about references to legacy params.

    // TODO: Add this function to the scope in which it was defined.
    // This is tricky because we need to know if it is being assigned to something, e.g. a var, static, etc, so that we can add it to the correct scope with the correct name.

    // Process the function body
    this.visit(children.blockStatement);

    // End the scope
    const endBrace = fixITokenLocation(
      children.blockStatement[0].children.EndBrace[0],
    );
    this.PROCESSOR.scope.setEnd(endBrace);
    this.PROCESSOR.popScope(endBrace, true);
    return functionType;
  }

  /** Called on *naked* identifiers and those that have accessors/suffixes of various sorts. */
  override identifierAccessor(children: IdentifierAccessorCstChildren): Type {
    let finalType: Type = this.UNKNOWN;
    let currentItem = this.identifier(children.identifier[0].children);
    if (!currentItem) {
      return finalType;
    }
    let currentLocation = children.identifier[0].location!;
    const suffixes = sortedAccessorSuffixes(children.accessorSuffixes);
    assert(suffixes, 'Expected suffixes');
    if (!suffixes.length) {
      return finalType;
    }

    // Compute useful metadata
    /** If true, then the `new` keyword prefixes this. */
    const usesNew = !!children.New?.length;
    /** If not `undefined`, this is the assignment node */
    const assignment = children.assignment?.[0];
    const assignmentType = assignment?.children.assignmentRightHandSide
      ? this.assignmentRightHandSide(
          assignment.children.assignmentRightHandSide[0].children,
        )
      : this.UNKNOWN;
    this.UPDATE_TYPE_WITH_DOCS(assignmentType);

    // For each suffix in turn, try to figure out how it changes the scope,
    // find the corresponding symbol, etc.

    suffixLoop: for (let s = 0; s < suffixes.length; s++) {
      const suffix = suffixes[s];
      const currentType = currentItem?.item ? getType(currentItem.item) : null;
      const isLastSuffix = s === suffixes.length - 1;
      switch (suffix.name) {
        case 'dotAccessSuffix':
          // Then we need to change self-scope to be inside
          // the prior struct.
          const dotAccessor = suffix.children;
          const dot = fixITokenLocation(dotAccessor.Dot[0]);
          if (typeIs(currentType, 'Struct') || typeIs(currentType, 'Enum')) {
            this.PROCESSOR.scope.setEnd(dot);
            this.PROCESSOR.pushSelfScope(dot, currentType, true, {
              accessorScope: true,
            });
            // While editing a user will dot into something
            // prior to actually adding the new identifier.
            // To provide autocomplete options, we need to
            // still add a scopeRange for the dot.
            if (isEmpty(dotAccessor.identifier[0].children)) {
              this.PROCESSOR.scope.setEnd(dot, true);
              this.PROCESSOR.popSelfScope(dot, true);
              currentItem = undefined;
              finalType = this.UNKNOWN;
            } else {
              const nextIdentity = identifierFrom(dotAccessor);
              let nextItem = this.identifier(
                dotAccessor.identifier[0].children,
              );
              const nextItemLocation = dotAccessor.identifier[0].location!;
              if (!nextItem && typeIs(currentType, 'Struct')) {
                // Then this variable is not yet defined on this struct.
                // We need to add it!
                ok(nextIdentity, 'Could not get next identity');
                const range = this.PROCESSOR.range(nextItemLocation);
                const newMemberType = isLastSuffix
                  ? assignmentType
                  : this.UNKNOWN;
                // Add this member to the struct
                const newMember: TypeMember = currentType.addMember(
                  nextIdentity.name,
                  newMemberType,
                );
                const ref = newMember.addRef(range);
                // If this is the last suffix and this is
                // an assignment, then also set the `def` of the
                // new member.
                if (isLastSuffix && assignment) {
                  newMember.definedAt(range);
                } else {
                  // TODO: Else emit a warning that this member is
                  // not definitely defined.
                  this.PROCESSOR.addDiagnostic(
                    nextItemLocation,
                    `Member ${nextIdentity.name} is not definitely defined`,
                  );
                }
                nextItem = {
                  item: newMember,
                  ref,
                };
              } else {
                finalType = nextItem?.item
                  ? getType(nextItem.item)
                  : this.UNKNOWN;
              }
              currentItem = nextItem;
              currentLocation = nextItemLocation;
              this.PROCESSOR.scope.setEnd(currentLocation, true);
              this.PROCESSOR.popSelfScope(currentLocation, true);
            }
          } else {
            this.PROCESSOR.addDiagnostic(
              currentLocation,
              `Type ${currentType?.toFeatherString()} is not a struct`,
            );
            finalType = this.UNKNOWN;
            continue suffixLoop;
          }
          break;
        case 'functionArguments':
          // Create the argumentRanges between the parense and each comma
          const argsAndSeps = sortedFunctionCallParts(suffix);
          let argIdx = 0;
          let lastDelimiter: IToken;
          let lastTokenWasDelimiter = true;
          const ranges: FunctionArgRange[] = [];
          argLoop: for (let i = 0; i < argsAndSeps.length; i++) {
            const token = argsAndSeps[i];
            const isSep = 'image' in token;
            if (isSep) {
              fixITokenLocation(token);
              if (token.image === '(') {
                lastDelimiter = token;
                continue argLoop;
              }

              // Otherwise create the range
              // For some reason the end position is the same
              // as the start position for the commas and parens
              // Start on the RIGHT side of the first delimiter
              const start = Position.fromCstEnd(
                this.PROCESSOR.file,
                lastDelimiter!,
              );
              // end on the LEFT side of the second delimiter
              const end = Position.fromCstStart(this.PROCESSOR.file, token);
              const funcRange = new FunctionArgRange(
                currentItem!.ref,
                argIdx,
                start,
                end,
              );
              if (!lastTokenWasDelimiter) {
                funcRange.hasExpression = true;
              }
              this.PROCESSOR.file.addFunctionArgRange(funcRange);
              ranges.push(funcRange);

              // Increment the argument idx for the next one
              lastDelimiter = token;
              lastTokenWasDelimiter = true;
              argIdx++;
            } else {
              lastTokenWasDelimiter = false;
              this.visit(token);
            }
          }
          // Set the current item to the return type,
          // so that we can chain suffixes.
          const returnType =
            usesNew && isLastSuffix
              ? currentType?.constructs
              : currentType?.returns;
          currentItem = { item: returnType!, ref: currentItem!.ref };
          // Add the function call to the file for diagnostics
          this.PROCESSOR.file.addFunctionCall(ranges);
          finalType = returnType || this.UNKNOWN;
          break;
        default:
          this.visit(suffix);
      }
    }
    return finalType;
  }

  /** Static params are unambiguously defined. */
  override staticVarDeclarations(children: StaticVarDeclarationsCstChildren) {
    // Add to the self scope.
    const self = this.PROCESSOR.currentSelf;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    const type =
      this.assignmentRightHandSide(
        children.assignmentRightHandSide[0].children,
      ) || this.UNKNOWN;
    this.UPDATE_TYPE_WITH_DOCS(type);

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

    const type = children.assignmentRightHandSide
      ? this.assignmentRightHandSide(
          children.assignmentRightHandSide[0].children,
        )
      : this.UNKNOWN;
    this.UPDATE_TYPE_WITH_DOCS(type);

    const member = local
      .addMember(children.Identifier[0].image, type)
      .definedAt(range);
    member.local = true;
    member.addRef(range);
  }

  override variableAssignment(children: VariableAssignmentCstChildren) {
    // See if this identifier is known.
    const identified = this.identifier(children);
    const item = identified?.item;
    const range = this.PROCESSOR.range(children.Identifier[0]);

    const assignedType = this.assignmentRightHandSide(
      children.assignmentRightHandSide[0].children,
    );
    this.UPDATE_TYPE_WITH_DOCS(assignedType);

    if (!item) {
      // Create a new member on the self scope, unless it's global
      const fullScope = this.PROCESSOR.fullScope;
      if (fullScope.self !== fullScope.global) {
        // Then we can add a new member
        const member = fullScope.self
          .addMember(children.Identifier[0].image, assignedType)
          .definedAt(range);
        member.addRef(range);
        member.instance = true;
      } else {
        // TODO: Add a diagnostic
      }
    } else {
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
      if (parts.assignmentRightHandSide) {
        const type = this.assignmentRightHandSide(
          parts.assignmentRightHandSide[0].children,
        );
        this.UPDATE_TYPE_WITH_DOCS(type);
        if (type instanceof Type) {
          const member = struct.addMember(name, type).definedAt(range);
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
    // TODO: Infer the content type of the array

    // Make sure that the content is visited
    this.visit(children.assignmentRightHandSide || []);
    return this.PROCESSOR.project.createType('Array');
  }

  //#endregion
}
