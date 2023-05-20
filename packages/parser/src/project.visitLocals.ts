// CST Visitor for creating an AST etc
import { assert } from '@bscotch/utility';
import type { CstNode } from 'chevrotain';
import type {
  EnumStatementCstChildren,
  FunctionArgumentsCstChildren,
  FunctionExpressionCstChildren,
  FunctionParameterCstChildren,
  IdentifierAccessorCstChildren,
  IdentifierCstChildren,
  LocalVarDeclarationCstChildren,
  StaticVarDeclarationsCstChildren,
  WithStatementCstChildren,
} from '../gml-cst.js';
import { GmlSymbolType } from './gml.js';
import { GmlVisitorBase, identifierFrom } from './parser.js';
import type { GmlFile } from './project.gml.js';
import { Location, RawLocation } from './project.locations.js';
import { LocalScope, ScopeRange } from './project.scopes.js';
import {
  GlobalSelf,
  GlobalSymbolType,
  InstanceSelf,
  StructSelf,
} from './project.selfs.js';
import { Enum, ProjectSymbolType } from './project.symbols.js';

type SelfType = InstanceSelf | StructSelf | GlobalSelf;
type SymbolType = ProjectSymbolType | GlobalSymbolType | GmlSymbolType;

class SymbolProcessor {
  protected readonly localScopeStack: LocalScope[] = [];
  protected readonly selfStack: SelfType[] = [];
  /** The current ScopeRange, updated as we push/pop local and self */
  protected scopeRange: ScopeRange;
  readonly location: Location;

  constructor(readonly file: GmlFile) {
    this.scopeRange = file.scopeRanges[0];
    this.localScopeStack.push(this.scopeRange.local);
    this.location = this.scopeRange.start;
    this.pushLocalScope({ startOffset: 0 });
  }

  get scope() {
    return {
      local: this.currentLocalScope,
      self: this.currentSelf,
      global: this.project.self,
      selfIsGlobal: this.currentSelf === this.project.self,
    };
  }

  get resource() {
    return this.file.resource;
  }

  get project() {
    return this.resource.project;
  }

  get currentLocalScope() {
    return this.localScopeStack.at(-1)!;
  }

  get currentSelf() {
    return this.selfStack.at(-1) || this.project.self;
  }

  getGlobalSymbol(name: string): GlobalSymbolType | undefined {
    return this.project.self.getSymbol(name);
  }

  protected nextScopeRange(token: RawLocation) {
    this.scopeRange = this.scopeRange.createNext(token);
    this.file.scopeRanges.push(this.scopeRange);
    return this.scopeRange;
  }

  pushScope(token: RawLocation, self: SelfType) {
    const localScope = new LocalScope(this.location.at(token));
    this.localScopeStack.push(localScope);
    this.nextScopeRange(token).local = localScope;
    this.selfStack.push(self);
    this.scopeRange.self = self;
  }

  popScope(token: RawLocation) {
    this.localScopeStack.pop();
    this.selfStack.pop();
    this.nextScopeRange(token).local = this.currentLocalScope;
    this.scopeRange.self = this.currentSelf;
  }

  pushLocalScope(token: RawLocation) {
    const localScope = new LocalScope(this.location.at(token));
    this.localScopeStack.push(localScope);
    this.nextScopeRange(token).local = localScope;
  }

  popLocalScope(token: RawLocation) {
    this.localScopeStack.pop();
    this.nextScopeRange(token).local = this.currentLocalScope;
  }

  pushSelfScope(token: RawLocation, self: SelfType) {
    this.selfStack.push(self);
    this.nextScopeRange(token).self = self;
  }

  popSelfScope(token: RawLocation) {
    this.selfStack.pop();
    this.nextScopeRange(token).self = this.currentSelf;
  }
}

export function processSymbols(file: GmlFile) {
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
    return this.PROCESSOR;
  }

  override enumStatement(children: EnumStatementCstChildren) {
    // During the global pass we will have already
    // created the enum symbol, so just add the members
    const enumName = identifierFrom(children);
    const symbol = this.PROCESSOR.getGlobalSymbol(enumName.name) as Enum;
    assert(
      symbol,
      `Enum symbol ${enumName.name} found onn local but not global pass.`,
    );
    for (let i = 0; i < children.enumMember.length; i++) {
      const member = children.enumMember[i];
      const name = member.children.Identifier[0];
      symbol.addMember(i, name, this.PROCESSOR.location.at(name));
    }
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
      new StructSelf(undefined, this.PROCESSOR.location.at(location)),
    );
    this.visit(children.blockableStatement);
    this.PROCESSOR.popSelfScope(this.PROCESSOR.location.atEnd(location));
  }

  override functionExpression(children: FunctionExpressionCstChildren) {
    const location = this.PROCESSOR.location.at(
      children.Identifier?.[0] || children.Function[0],
    );
    // Functions create a new localscope
    // If this is a constructor, add a new self scope
    // for it.
    // TODO: If JSDocs specify a different scope, use that
    let self = this.PROCESSOR.currentSelf;
    if (children.constructorSuffix?.[0].children) {
      self = new StructSelf(undefined, location);
      self.addRef(location);
    }
    this.PROCESSOR.pushScope(
      children.functionParameters[0].children.StartParen[0],
      self,
    );

    // Add the parameters as local variables
    this.visit(children.functionParameters);
    if (children.constructorSuffix) {
      this.visit(children.constructorSuffix);
    }
    this.visit(children.blockStatement);

    // End the scope
    this.PROCESSOR.popScope(children.blockStatement[0].children.EndBrace[0]);
  }

  override functionParameter(children: FunctionParameterCstChildren) {
    this.PROCESSOR.currentLocalScope.addSymbol(children.Identifier[0], true);
  }

  override functionArguments(children: FunctionArgumentsCstChildren) {
    // TODO: Need to collect function argument ranges to provide function signature
    // helpers. Basically we need the ranges between each comma in the argument list.
    const start = children.StartParen[0];
    const end = children.EndParen[0];
    const commas = children.Comma?.map((comma) => comma.startOffset) || [];
    // console.log(
    //   'functionArguments',
    //   start.startOffset,
    //   commas,
    //   end.startOffset,
    // );
    if (children.functionArgument) {
      this.visit(children.functionArgument);
    }
  }

  override staticVarDeclarations(children: StaticVarDeclarationsCstChildren) {
    // Add to the self scope.
    const self = this.PROCESSOR.currentSelf as StructSelf;
    self.addSymbol(this.PROCESSOR.file, children.Identifier[0]);
    this.visit(children.assignmentRightHandSide);
  }

  override localVarDeclaration(children: LocalVarDeclarationCstChildren) {
    this.PROCESSOR.currentLocalScope.addSymbol(children.Identifier[0]);
    if (children.assignmentRightHandSide) {
      this.visit(children.assignmentRightHandSide);
    }
  }

  override identifierAccessor(children: IdentifierAccessorCstChildren) {
    // Identify struct-accessor chains
    const accessing = this.visit(children.identifier[0]) as
      | SymbolType
      | undefined;

    if (!children.accessorSuffixes) {
      return;
    }
    // For each accessor suffix, figure out what we're accessing in turn
    // TODO: Handle function calls
    // TODO: Handle array access
    // TODO: Handle dot access
    // Start with one-level-deep dot access for SELF, GLOBAL, and ENUMs
    const dotAccessWith =
      children.accessorSuffixes[0].children.dotAccessSuffix?.[0].children;
    if (dotAccessWith && accessing?.kind === 'enum') {
      const identifier = identifierFrom(dotAccessWith);
      const enumMember = accessing.getMember(identifier.name);
      if (!enumMember) {
        // TODO: Send a diagnostic
      } else {
        // TODO: Add the ref!
        // enumMember.addRef(this.PROCESSOR.location.at(identifier.token));
      }
    } else {
      // fallback
      this.visit(children.accessorSuffixes);
    }

    // for (const suffix of children.accessorSuffixes) {
    //   const suffixType = keysOf(suffix.children)[0];
    //   switch (suffixType) {
    //     case 'dotAccessSuffix':
    //       identifiers.push(
    //         identifierFrom(suffix.children.dotAccessSuffix![0]).name,
    //       );
    //       break;
    //   }
    // }
    // console.log('identifiers', identifiers);
  }

  /**
   * Fallback identifier handler */
  override identifier(children: IdentifierCstChildren): SymbolType | undefined {
    const identifier = identifierFrom(children);
    const scope = this.PROCESSOR.scope;
    let symbol: SymbolType | undefined;
    const location = this.PROCESSOR.location.at(identifier.token);

    switch (identifier.type) {
      case 'Global':
        // Global is a special case, it's a keyword and also
        // a globalvar.
        symbol = scope.global.getSymbol('global');
        break;
      case 'Self':
        // Then we're reference our current self context
        symbol = scope.self.getSymbol('self');
        break;
      case 'Identifier':
        const { name } = identifier;
        // Is it local?
        if (scope.local.hasSymbol(name)) {
          symbol = scope.local.getSymbol(name)!;
        }
        // Is it a non-global selfvar?
        else if (!scope.selfIsGlobal && scope.self.hasSymbol(name)) {
          symbol = scope.self.getSymbol(name)!;
        }
        // Is it a globalvar?
        else if (scope.global.hasSymbol(name)) {
          symbol = this.PROCESSOR.project.self.getSymbol(name)!;
        }
        // Is it a builtin global?
        else if (scope.global.gml.has(name)) {
          symbol = scope.global.gml.get(name)!;
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
    if (symbol) {
      symbol.addRef(location);
    }
    return symbol;
  }
}
