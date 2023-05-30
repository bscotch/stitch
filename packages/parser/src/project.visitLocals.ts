// CST Visitor for creating an AST etc
import { randomString } from '@bscotch/utility';
import { ok } from 'assert';
import type { CstNode, CstNodeLocation } from 'chevrotain';
import type {
  FunctionExpressionCstChildren,
  IdentifierAccessorCstChildren,
  IdentifierCstChildren,
  LocalVarDeclarationCstChildren,
  StaticVarDeclarationsCstChildren,
  WithStatementCstChildren,
} from '../gml-cst.js';
import { GmlVisitorBase, identifierFrom } from './parser.js';
import type { Code } from './project.code.js';
import { Diagnostic } from './project.diagnostics.js';
import {
  FunctionArgRange,
  Position,
  Range,
  ReferenceableType,
  Scope,
} from './project.location.js';
import { Symbol } from './project.symbol.js';
import { StructType, Type, TypeMember } from './project.type.js';

class SymbolProcessor {
  protected readonly localScopeStack: StructType[] = [];
  protected readonly selfStack: StructType[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  protected scope: Scope;
  readonly position: Position;
  readonly diagnostics: Diagnostic[] = [];

  constructor(readonly file: Code) {
    this.scope = file.scopes[0];
    this.localScopeStack.push(this.scope.local);
    this.position = this.scope.start;
  }

  range(loc: CstNodeLocation) {
    return Range.fromCst(this.position.file, loc);
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
    this.file.scopes.at(-1)!.end = this.scope.end.atEnd(rootNode);
  }

  createStruct(token: CstNodeLocation) {
    return new Type('Struct').definedAt(this.range(token));
  }

  pushScope(token: CstNodeLocation, self: StructType, fromTokenEnd: boolean) {
    const localScope = this.createStruct(token);
    this.localScopeStack.push(localScope);
    this.nextScope(token, fromTokenEnd).local = localScope;
    this.selfStack.push(self);
    this.scope.self = self;
  }

  popScope(token: CstNodeLocation, fromTokenEnd: boolean) {
    this.localScopeStack.pop();
    this.selfStack.pop();
    this.nextScope(token, fromTokenEnd).local = this.currentLocalScope;
    this.scope.self = this.currentSelf;
  }

  pushLocalScope(token: CstNodeLocation, fromTokenEnd: boolean) {
    const localScope = this.createStruct(token);
    this.localScopeStack.push(localScope);
    this.nextScope(token, fromTokenEnd).local = localScope;
  }

  popLocalScope(token: CstNodeLocation, fromTokenEnd: boolean) {
    this.localScopeStack.pop();
    this.nextScope(token, fromTokenEnd).local = this.currentLocalScope;
  }

  pushSelfScope(
    token: CstNodeLocation,
    self: StructType,
    fromTokenEnd: boolean,
  ) {
    this.selfStack.push(self);
    this.nextScope(token, fromTokenEnd).self = self;
  }

  popSelfScope(token: CstNodeLocation, fromTokenEnd: boolean) {
    this.selfStack.pop();
    this.nextScope(token, fromTokenEnd).self = this.currentSelf;
  }
}

export function processSymbols(file: Code) {
  const processor = new SymbolProcessor(file);
  const visitor = new GmlSymbolVisitor(processor);
  visitor.visit(file.cst);
}

export class GmlSymbolVisitor extends GmlVisitorBase {
  static validated = false;
  constructor(readonly PROCESSOR: SymbolProcessor) {
    super();
    this.validateVisitor();
  }

  findSymbols(input: CstNode) {
    this.visit(input);
    this.PROCESSOR.setLastScopeEnd(input.location!);
    return this.PROCESSOR;
  }

  override withStatement(children: WithStatementCstChildren) {
    // With statements change the self scope to
    // whatever their expression evaluates to.
    // For now, just create a new self scope
    // TODO: Figure out the actual self scope
    this.visit(children.expression);
    const location = children.blockableStatement[0].location!;
    this.PROCESSOR.pushSelfScope(
      location,
      this.PROCESSOR.createStruct(location),
      false,
    );
    this.visit(children.blockableStatement);
    this.PROCESSOR.popSelfScope(location, true);
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    // Compute useful properties of this function to help figure out
    // how to define its symbol, type, scope, etc.
    const isAnonymous = !children.Identifier;
    let functionName: string | undefined = children.Identifier?.[0]?.image;
    const isConstructor = !!children.constructorSuffix;
    const functionTypeName = isConstructor ? 'Constructor' : 'Function';
    const isInRootLocalScope =
      this.PROCESSOR.currentLocalScope === this.PROCESSOR.file.scopes[0].local;
    const isInScript = this.PROCESSOR.asset.assetType === 'scripts';
    const isInObject = this.PROCESSOR.asset.assetType === 'objects';
    const isGlobal = isInRootLocalScope && isInScript;
    const isInstance = isInRootLocalScope && isInObject;
    const bodyLocation = children.blockStatement[0].location!;

    // If this is global we should already have a symbol for it.
    // If not, we should create a new symbol.
    const symbol = (
      isGlobal && !isAnonymous
        ? this.PROCESSOR.getGlobalSymbol(functionName!)?.symbol
        : new Symbol(
            functionName || `anonymous_function_${randomString(8, 'base64')}`,
            this.PROCESSOR.file.createType(functionTypeName),
          )
    ) as Symbol | TypeMember;
    // Might have been anonymous, so get the random name
    functionName = symbol.name;
    // Make sure we have a proper type
    if (symbol.type.kind === 'Unknown') {
      symbol.type.kind = functionTypeName;
    }

    // Get or create the function type
    const functionType = symbol.type;
    ok(functionType.isFunction, 'Expected function type');

    // Ensure that constructors have an attached constructed type
    if (isConstructor && !functionType.constructs) {
      functionType.constructs =
        this.PROCESSOR.createStruct(bodyLocation).named(functionName);
    }

    // Identify the "self" struct. If this is a constructor, "self" is the
    // constructed type. Otherwise, for now just create a new struct type
    // for the self scope.
    // TODO: Figure out the actual self scope (e.g. from JSDocs or type inference)
    const self = (
      isConstructor
        ? functionType.constructs
        : this.PROCESSOR.createStruct(bodyLocation)
    )!;

    // Functions have their own localscope as well as their self scope,
    // so we need to push both.
    this.PROCESSOR.pushScope(
      children.functionParameters[0].children.StartParen[0],
      self,
      false,
    );
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
      // TODO: Use JSDocs to determine the type of the parameter
      const paramType = this.PROCESSOR.file
        .createType('Unknown')
        .definedAt(range);
      const optional = !!params[i].children.Assign;
      functionType.addParameter(i, param.image, paramType, optional);

      // Also add to the function's local scope.
      functionLocalScope.addMember(param.image, paramType);
    }
    // TODO: Remove any excess parameters, e.g. if we're updating a
    // prior definition. This is tricky since we may need to do something
    // about references to legacy params.

    // TODO: Add this function to the scope in which it was defined.
    // This is tricky because we need to know if it is being assigned to something, e.g. a var, static, etc, so that we can add it to the correct scope with the correct name.

    // Process the function body
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popScope(
      children.blockStatement[0].children.EndBrace[0],
      false,
    );
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    const item = this.identifier(children.identifier[0].children);
    const identifierLocation = children.identifier[0].location!;
    if (!item) {
      return;
    }
    const type = item.$tag === 'Type' ? item : item.type;
    const suffixes = children.accessorSuffixes?.[0].children;
    if (!suffixes) {
      return;
    }
    const functionArguments = suffixes.functionArguments?.[0].children;
    if (functionArguments) {
      const toVisit: CstNode[] = [];
      if (!type.isFunction) {
        if (!['Unknown', 'Any', 'Mixed'].includes(type.kind)) {
          // Then we can be pretty confident we have a type error
          this.PROCESSOR.addDiagnostic(
            suffixes.functionArguments![0].location!,
            `Type ${type.toFeatherString()} is not callable`,
          );
        }
        return;
      }
      // Create the argumentRanges between the parense and each comma
      const params = type.params || [];
      const args = functionArguments.functionArgument || [];
      const positions = [
        functionArguments.StartParen[0],
        ...(functionArguments.Comma?.map((comma) => comma) || []),
        functionArguments.EndParen[0],
      ];
      let restType: Type | undefined;
      for (let i = 0; i < positions.length - 1; i++) {
        const start = Position.fromCstEnd(this.PROCESSOR.file, positions[i]);
        const end = Position.fromCstStart(
          this.PROCESSOR.file,
          positions[i + 1],
        );
        const arg = args[i];
        const param = params[i];
        if (param?.name === '...') {
          restType = param.type;
        }
        toVisit.push(arg);
        const location = arg?.location || identifierLocation;
        if (!param && !restType) {
          this.PROCESSOR.addDiagnostic(location, `Too many arguments`);
          break;
        }
        if (!arg) {
          if (!param.optional) {
            this.PROCESSOR.addDiagnostic(
              location,
              `Missing required argument ${param.name}`,
              'error',
            );
          }
        }
        const funcRange = new FunctionArgRange(param, start, end);
        this.PROCESSOR.file.addFunctionArgRange(funcRange);
      }
      // Visit all of the arguments to ensure they are fully processed
      this.visit(toVisit);
    } else {
      this.visit(children.accessorSuffixes || []);
    }
  }

  /** Static params are unambiguously defined. */
  override staticVarDeclarations(children: StaticVarDeclarationsCstChildren) {
    // Add to the self scope.
    const self = this.PROCESSOR.currentSelf;
    const member = self.addMember(
      children.Identifier[0].image,
      this.PROCESSOR.file
        .createType('Unknown')
        .definedAt(this.PROCESSOR.range(children.Identifier[0])),
    );
    member.isStatic = true;
    this.visit(children.assignmentRightHandSide);
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    const local = this.PROCESSOR.currentLocalScope;
    const member = local.addMember(
      children.Identifier[0].image,
      this.PROCESSOR.file
        .createType('Unknown')
        .definedAt(this.PROCESSOR.range(children.Identifier[0])),
    );
    if (children.assignmentRightHandSide) {
      this.visit(children.assignmentRightHandSide);
    }
  }

  /**
   * Fallback identifier handler. Figure out what a given
   * identifier is referencing, and create appropriate references
   * to make that work.*/
  override identifier(
    children: IdentifierCstChildren,
  ): ReferenceableType | undefined {
    const identifier = identifierFrom(children);
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
        // Is it local?
        const local = scope.local.getMember(name);
        if (local) {
          item = local;
          break;
        }
        // Is it a non-global selfvar?
        const selfvar = !scope.selfIsGlobal && scope.self.getMember(name);
        if (selfvar) {
          item = selfvar;
          break;
        }
        // Is it a global?
        const globalvar = this.PROCESSOR.project.getGlobal(name);
        if (globalvar) {
          item = globalvar.symbol;
          break;
        }
        // TODO: Emit error?
        else {
          // console.error('Unknown symbol', name);
        }
        break;
      default:
        // TODO: Handle `other` and `all` keywords
        break;
    }
    if (item) {
      item.addRef(range);
    }
    return item;
  }
}
