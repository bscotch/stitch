/**
 * The checker: walks a file's syntax tree against the project's symbol
 * table, resolving names, inferring types, and recording references,
 * scopes, calls, member contributions and diagnostics.
 */
import type {
  Argument,
  Assignment,
  CallExpression,
  DocComment,
  DocTag,
  DocType,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  MemberExpression,
  NewExpression,
  Statement,
  StructLiteral,
  Token,
} from '@bscotch/gml-syntax';
import { tokenIndexAt, walk } from '@bscotch/gml-syntax';
import type {
  ArgumentRange,
  DiagnosticCode,
  DiagnosticSeverity,
  FileAnalysis,
  FileDependencies,
  MemberContribution,
} from './analysis.types.ts';
import { docDescription, docTag, docTags } from './docs.ts';
import type { ParsedFile } from './file.ts';
import {
  ids,
  SymbolTable,
  type DependencyRecorder,
  type FunctionEntry,
  type FunctionId,
  type ShapeEntry,
  type ShapeId,
  type SymbolEntry,
  type SymbolKind,
} from './symbols.ts';
import {
  isUntyped,
  ofKind,
  T,
  typeFromDoc,
  union,
  withableKinds,
  type DocTypeContext,
  type Type,
  type TypeUnion,
} from './types.ts';

export interface CheckOptions {
  /** Undeclared globals with these prefixes are assumed to be declared elsewhere (e.g. by extensions) */
  autoDeclareGlobalsPrefixes?: string[];
}

/** The `self` scope a piece of code runs in */
interface Frame {
  /** What created the frame */
  kind?: 'file' | 'function' | 'with';
  /** The local scope shape */
  local: ShapeId;
  /** The self type (`undefined` = the global scope) */
  self?: Type;
  selfShape?: ShapeId;
  /** Assignments to this shape are definitive declarations */
  definitive?: ShapeId;
  /** Shapes whose code this is (an object's events, a constructor's body) */
  own?: ShapeId;
  /** The function being checked, for collecting return types */
  fn?: { returns: Type[]; entry: FunctionEntry };
  /**
   * `self` is whatever instance calls the code (in script functions), so
   * names that aren't found may be the caller's variables.
   */
  callerSelf?: boolean;
}

const numericOperators = new Set([
  '-',
  '*',
  '/',
  '%',
  'div',
  '&',
  '|',
  '^',
  '<<',
  '>>',
]);
const booleanOperators = new Set([
  '==',
  '!=',
  '=',
  '<',
  '<=',
  '>',
  '>=',
  '&&',
  '||',
  '^^',
]);

/** Dependency recorder that collects into a `FileDependencies` */
function recorder(deps: FileDependencies): DependencyRecorder {
  return {
    member(shape, name) {
      let names = deps.members.get(shape);
      if (!names) deps.members.set(shape, (names = new Set()));
      names.add(name);
    },
    symbol(id) {
      deps.symbols.add(id);
    },
  };
}

export class Checker {
  protected readonly table: SymbolTable;
  protected readonly out: FileAnalysis;
  protected readonly deps: DependencyRecorder;
  protected readonly frames: Frame[] = [];
  protected readonly fileId: string;
  protected readonly tokens: Token[];
  protected readonly text: string;
  /** Shapes owned by this file */
  protected readonly ownedShapes = new Map<ShapeId, ShapeEntry>();
  protected readonly ownedFunctions = new Map<FunctionId, FunctionEntry>();
  protected readonly ownedSymbols = new Map<string, SymbolEntry>();
  /** The file's own object/constructor shape */
  protected readonly fileSelf: Frame;

  protected readonly natives: SymbolTable;
  /** Doc-comment variable declarations not yet processed, in order */
  protected readonly pendingDocVariables: ParsedFile['docs']['variables'];
  /** Top-level function declarations in scripts (which are global) */
  protected readonly globalFunctionNodes = new Set<FunctionDeclaration>();

  protected readonly pf: ParsedFile;
  protected readonly options: CheckOptions;

  constructor(
    pf: ParsedFile,
    tables: { project: SymbolTable; natives: SymbolTable },
    options: CheckOptions = {},
  ) {
    this.pf = pf;
    this.options = options;
    this.table = new SymbolTable(tables.project);
    this.natives = tables.natives;
    this.pendingDocVariables = [...pf.docs.variables].sort(
      (a, b) => a.tag.start - b.tag.start,
    );
    if (pf.file.kind === 'script') {
      // Function declarations in scripts are global, unless they're inside
      // another function (even if they're in an `if` block)
      walk(pf.parsed.ast, (node) => {
        if (node.kind === 'FunctionDeclaration') {
          this.globalFunctionNodes.add(node);
          return false;
        }
        if (node.kind === 'FunctionExpression') return false;
        return undefined;
      });
    }
    this.fileId = pf.file.id;
    this.tokens = pf.parsed.tokens;
    this.text = pf.text;
    this.out = {
      file: pf.file.id,
      hash: pf.hash,
      refs: [],
      scopes: [],
      argumentRanges: [],
      calls: [],
      structMemberRanges: [],
      diagnostics: [],
      members: [],
      owned: { shapes: [], functions: [], symbols: [] },
      deps: { members: new Map(), symbols: new Set(), functions: new Set() },
      callsInherited: false,
    };
    this.deps = recorder(this.out.deps);
    const fileLocal = this.ownShape(ids.local(`file:${this.fileId}`), 'local');
    const file = pf.file;
    let self: Type | undefined;
    let selfShape: ShapeId | undefined;
    if (file.kind === 'objectEvent') {
      self = { kind: 'Id.Instance', name: file.asset };
      selfShape = ids.objectShape(file.asset);
    } else if (file.kind === 'instanceCreation' && file.object) {
      self = { kind: 'Id.Instance', name: file.object };
      selfShape = ids.objectShape(file.object);
    }
    this.fileSelf = {
      kind: 'file',
      local: fileLocal.id,
      self,
      selfShape,
      definitive:
        file.kind === 'objectEvent' && file.event === 'Create_0'
          ? selfShape
          : undefined,
      own: selfShape,
    };
  }

  check(): FileAnalysis {
    const { ast } = this.pf.parsed;
    this.frames.push(this.fileSelf);
    this.pushScope(0, this.text.length);
    for (const diagnostic of this.pf.parsed.diagnostics) {
      this.diagnostic(
        'syntax',
        diagnostic.severity === 'warning' ? 'warning' : 'error',
        diagnostic.message,
        diagnostic,
      );
    }
    for (const statement of ast.body) this.statement(statement);
    this.flushDocVariables(Infinity);
    this.checkDocTypeReferences();
    this.frames.pop();
    this.out.owned = {
      shapes: [...this.ownedShapes.values()],
      functions: [...this.ownedFunctions.values()],
      symbols: [...this.ownedSymbols.values()],
    };
    const byStart = (a: { start: number }, b: { start: number }) =>
      a.start - b.start;
    this.out.refs.sort(byStart);
    this.out.argumentRanges.sort(byStart);
    this.out.structMemberRanges.sort(byStart);
    this.out.diagnostics.sort(byStart);
    return this.out;
  }

  //#region Helpers

  protected get frame(): Frame {
    return this.frames.at(-1)!;
  }

  protected diagnostic(
    code: DiagnosticCode,
    severity: DiagnosticSeverity,
    message: string,
    at: { start: number; end: number },
  ) {
    this.out.diagnostics.push({
      code,
      severity,
      message,
      start: at.start,
      end: at.end,
    });
  }

  protected ref(
    at: { start: number; end: number },
    symbol: SymbolEntry | string,
    extra?: { implicit?: boolean; write?: boolean },
  ) {
    if (at.end <= at.start) return;
    this.out.refs.push({
      start: at.start,
      end: at.end,
      symbol: typeof symbol === 'string' ? symbol : symbol.id,
      ...extra,
    });
  }

  protected pushScope(start: number, end: number, dot = false) {
    const frame = this.frame;
    this.out.scopes.push({
      start,
      end,
      local: frame.local,
      self: frame.selfShape,
      selfType: frame.self ?? { kind: 'Struct', name: 'global' },
      dot: dot || undefined,
    });
  }

  /** Create a shape owned by this file */
  protected ownShape(
    id: ShapeId,
    kind: ShapeEntry['kind'],
    extra?: Partial<ShapeEntry>,
  ): ShapeEntry {
    let shape = this.ownedShapes.get(id);
    if (!shape) {
      shape = { id, kind, parents: [], members: new Map(), ...extra };
      this.ownedShapes.set(id, shape);
      this.table.shapes.set(id, shape);
    }
    return shape;
  }

  /**
   * Add a symbol owned by this file. Unless `hidden`, it becomes a member of
   * its owner shape (hidden symbols, like documented-only parameters, exist
   * but can't be referenced by name).
   */
  protected ownSymbol(
    entry: SymbolEntry,
    options?: { hidden?: boolean },
  ): SymbolEntry {
    const shape = this.ownedShapes.get(entry.owner);
    const existing = shape && this.ownedSymbols.get(entry.id);
    if (existing) return existing;
    this.ownedSymbols.set(entry.id, entry);
    this.table.symbols.set(entry.id, entry);
    if (!options?.hidden) shape?.members.set(entry.name, entry.id);
    return entry;
  }

  protected ownFunction(entry: FunctionEntry): FunctionEntry {
    this.ownedFunctions.set(entry.id, entry);
    this.table.functions.set(entry.id, entry);
    return entry;
  }

  /**
   * Contribute a member to a (project) shape, making it visible to the rest
   * of this file's check right away.
   */
  protected contribute(
    contribution: Omit<MemberContribution, 'file'>,
  ): SymbolEntry {
    const full: MemberContribution = { ...contribution, file: this.fileId };
    this.out.members.push(full);
    const id = ids.member(full.shape, full.name);
    // Already visible (from the project table or earlier in this file)?
    const existing = this.table.getShape(full.shape)?.members.has(full.name)
      ? this.table.getSymbol(
          this.table.getShape(full.shape)!.members.get(full.name),
        )
      : this.table.findMember(full.shape, full.name, undefined, {
          ownOnly: true,
        });
    if (existing) return existing;
    // Make it visible to this file
    let overlay = this.table.shapes.get(full.shape);
    if (!overlay) {
      const base = this.table.getShape(full.shape);
      overlay = {
        id: full.shape,
        kind: base?.kind ?? 'struct',
        name: base?.name,
        symbol: base?.symbol,
        parents: base?.parents ?? [],
        members: new Map(),
      };
      this.table.shapes.set(full.shape, overlay);
    }
    if (full.alias) {
      overlay.members.set(full.name, full.alias);
      return this.table.getSymbol(full.alias)!;
    }
    const symbol: SymbolEntry = {
      id,
      name: full.name,
      owner: full.shape,
      kind: full.kind,
      def: { file: this.fileId, start: full.start, end: full.end },
      type: full.declaredType ?? full.inferredType ?? [],
      description: full.description,
      fn: full.fn,
      shape: full.shapeRef,
      static: full.static,
      instance: full.instance,
      global: full.shape === ids.globalShape || undefined,
      deprecated: full.deprecated,
      mixin: full.mixin,
      writable: full.writable ?? true,
    };
    this.table.symbols.set(id, symbol);
    overlay.members.set(full.name, id);
    return symbol;
  }

  /**
   * Symbols whose types were read while evaluating the current expression.
   * Whoever consumes the expression's type decides whether its result
   * depends on them (see `used` and `unused`).
   */
  protected readonly typeReads: Set<string>[] = [];

  /** Get a symbol's type */
  protected typeOfSymbol(symbol: SymbolEntry): Type[] {
    const reads = this.typeReads.at(-1);
    if (reads) reads.add(symbol.id);
    else this.deps.symbol(symbol.id);
    return [...symbol.type];
  }

  /** Note that a function's return type was read (see `typeOfSymbol`) */
  protected readReturns(fn: FunctionId) {
    const key = `returns:${fn}`;
    const reads = this.typeReads.at(-1);
    if (reads) reads.add(key);
    else this.deps.symbol(key);
  }

  /** Evaluate something whose type affects the results */
  protected used<R>(fn: () => R): R {
    this.typeReads.push(new Set());
    try {
      return fn();
    } finally {
      for (const id of this.typeReads.pop()!) this.deps.symbol(id);
    }
  }

  /** Evaluate something whose type doesn't affect the results */
  protected unused<R>(fn: () => R): R {
    this.typeReads.push(new Set());
    try {
      return fn();
    } finally {
      this.typeReads.pop();
    }
  }

  protected getFunction(id: FunctionId | undefined): FunctionEntry | undefined {
    if (!id) return undefined;
    this.out.deps.functions.add(id);
    return this.table.getFunction(id);
  }

  protected findMember(
    shape: ShapeId | undefined,
    name: string,
    options?: { ownOnly?: boolean },
  ): SymbolEntry | undefined {
    if (shape?.startsWith('local:')) return this.findLocal(shape, name);
    return this.table.findMember(shape, name, this.deps, options);
  }

  /**
   * Local scopes are private to the file, so only look in what this check
   * has declared (not in results from earlier checks of the file).
   */
  protected findLocal(shapeId: ShapeId, name: string): SymbolEntry | undefined {
    const seen = new Set<ShapeId>();
    let queue: ShapeId[] = [shapeId];
    while (queue.length) {
      const next: ShapeId[] = [];
      for (const id of queue) {
        if (seen.has(id)) continue;
        seen.add(id);
        const shape = this.ownedShapes.get(id);
        if (!shape) continue;
        const symbolId = shape.members.get(name);
        if (symbolId) return this.ownedSymbols.get(symbolId);
        next.push(...shape.parents);
      }
      queue = next;
    }
    return undefined;
  }

  /** The shape holding a type's members, if any */
  protected shapeOfType(type: Type | undefined): ShapeId | undefined {
    if (!type) return undefined;
    if (type.entity && this.table.getShape(type.entity)) return type.entity;
    switch (type.kind) {
      case 'Struct':
        if (type.name === 'global') return ids.globalShape;
        return type.name ? ids.structShape(type.name) : undefined;
      case 'Id.Instance':
      case 'Asset.GMObject':
        return type.name ? ids.objectShape(type.name) : ids.instanceBase;
      case 'Enum':
        return type.name ? ids.enumShape(type.name) : undefined;
    }
    return undefined;
  }

  /** The function entity a type refers to, if any */
  protected functionOfType(type: Type | undefined): FunctionEntry | undefined {
    if (!type || type.kind !== 'Function') return undefined;
    if (type.entity) return this.getFunction(type.entity);
    if (type.name) return this.getFunction(ids.fn(type.name));
    return undefined;
  }

  /** Resolve type names from docs */
  protected docContext(generics?: Map<string, Type>): DocTypeContext {
    return {
      resolve: (name) => this.table.getType(name),
      generics,
      onUnknown: (name, span) =>
        this.diagnostic(
          'unknown-type',
          'warning',
          `Unknown type \`${name}\``,
          span,
        ),
    };
  }

  protected docType(
    tag: DocTag | undefined,
    generics?: Map<string, Type>,
  ): Type[] | undefined {
    if (!tag?.type) return undefined;
    return normalizeInferred(typeFromDoc(tag.type, this.docContext(generics)));
  }

  /** The span of just the name in a doc name like `[name=default]` */
  protected nameSpan(name: { name: string; start: number; end: number }) {
    const at = this.text.indexOf(name.name, name.start);
    const start = at >= 0 && at < name.end ? at : name.start;
    return { start, end: start + name.name.length };
  }

  protected docAt(offset: number): DocComment | undefined {
    return this.pf.docs.attached.get(offset);
  }

  /** Priority for a contribution to a shape from the current context */
  protected priorityFor(shape: ShapeId): number {
    if (shape === this.frame.definitive) return 0;
    if (shape === this.frame.own || shape === this.fileSelf.own) return 1;
    return 2;
  }

  //#endregion

  //#region Docs

  /**
   * Process `@localvar`, `@instancevar` and `@globalvar` doc comments that
   * appear before `offset`, in the current scope.
   */
  protected flushDocVariables(offset: number) {
    const pending = this.pendingDocVariables;
    while (pending.length && pending[0].tag.start < offset) {
      const variable = pending.shift()!;
      const name = variable.tag.name;
      if (!name) continue;
      const type = this.docType(variable.tag) ?? [T.any];
      const description = variable.tag.description?.text || undefined;
      const frame = this.frame;
      if (variable.kind === 'globalvar') {
        const symbol = this.contribute({
          shape: ids.globalShape,
          name: name.name,
          start: name.start,
          end: name.end,
          priority: 0,
          kind: 'variable',
          declaredType: type,
          description,
        });
        this.ref(name, symbol);
      } else if (variable.kind === 'localvar') {
        const symbol =
          this.findMember(frame.local, name.name) ??
          this.declareLocal(frame.local, name.name, name);
        symbol.type = type;
        symbol.description = description;
        this.ref(name, symbol);
      } else if (!frame.selfShape) {
        this.diagnostic(
          'global-self',
          'error',
          'Invalid variable documentation. Did you mean to use @globalvar?',
          name,
        );
      } else {
        const symbol = this.contribute({
          shape: frame.selfShape,
          name: name.name,
          start: name.start,
          end: name.end,
          priority: 0,
          kind: 'variable',
          declaredType: type,
          description,
          instance: true,
        });
        this.ref(name, symbol);
      }
    }
  }

  /** References from doc types and links to the symbols they name */
  protected checkDocTypeReferences() {
    for (const doc of this.pf.docs.all) {
      for (const tag of doc.tags) {
        if (tag.type) this.docTypeRefs(tag.type);
        // (`@see` targets are parsed as links too)
        for (const link of tag.description?.links || []) this.docLink(link);
      }
      for (const link of doc.description?.links || []) this.docLink(link);
    }
  }

  protected docTypeRefs(type: DocType) {
    if (type.kind === 'union') {
      type.types.forEach((t) => this.docTypeRefs(t));
      return;
    }
    if (type.kind !== 'named') return;
    type.args.forEach((t) => this.docTypeRefs(t));
    if (type.path.length < 2) return;
    // `Struct.Foo`, `Id.Instance.o_thing`, `Enum.Color`, `Asset.GMSprite.spr`, ...
    const last = type.path.at(-1)!;
    const prefix = type.path
      .slice(0, -1)
      .map((p) => p.name)
      .join('.')
      .toLowerCase();
    const namesGlobal =
      ['struct', 'enum', 'function', 'id.instance'].includes(prefix) ||
      prefix.startsWith('asset.');
    if (!namesGlobal) return;
    const symbol = this.findMember(ids.globalShape, last.name);
    if (symbol && !symbol.native) this.ref(last, symbol);
  }

  protected docLink(link: {
    target: string;
    targetSpan: { start: number; end: number };
  }) {
    if (/^[a-z]+:\/\//i.test(link.target)) return; // URLs
    this.docLinkTarget(link.target, link.targetSpan);
  }

  /** Resolve a `@see`/`{@link}` target like `foo` or `Foo.bar` */
  protected docLinkTarget(
    target: string,
    span: { start: number; end: number },
  ) {
    const parts = target.split('.');
    let symbol = this.findMember(ids.globalShape, parts[0]);
    let offset = span.start;
    if (symbol)
      this.ref({ start: offset, end: offset + parts[0].length }, symbol);
    for (const part of parts.slice(1)) {
      offset += parts[parts.indexOf(part) - 1]?.length + 1 || 0;
      const shape =
        symbol?.shape ??
        this.shapeOfType(symbol?.type[0]) ??
        this.table.getFunction(symbol?.fn)?.constructs;
      symbol = shape ? this.findMember(shape, part) : undefined;
      if (symbol)
        this.ref({ start: offset, end: offset + part.length }, symbol);
      else break;
    }
    if (!symbol) {
      this.diagnostic(
        'broken-link',
        'warning',
        `Cannot find \`${target}\``,
        span,
      );
    }
  }

  //#endregion

  //#region Statements

  protected statement(node: Statement): void {
    this.flushDocVariables(node.start);
    switch (node.kind) {
      case 'Block':
        node.body.forEach((s) => this.statement(s));
        return;
      case 'VariableDeclaration':
        return this.variableDeclaration(node);
      case 'Assignment':
        this.assignment(node, this.docAt(node.start));
        return;
      case 'ExpressionStatement':
        this.unused(() => this.expression(node.expression));
        return;
      case 'IfStatement':
        this.unused(() => this.expression(node.test));
        this.statement(node.consequent);
        if (node.alternate) this.statement(node.alternate);
        return;
      case 'WhileStatement':
        this.unused(() => this.expression(node.test));
        this.statement(node.body);
        return;
      case 'DoUntilStatement':
        this.statement(node.body);
        this.unused(() => this.expression(node.test));
        return;
      case 'ForStatement':
        if (node.init) this.statement(node.init);
        if (node.test) this.unused(() => this.expression(node.test!));
        if (node.update) this.statement(node.update);
        this.statement(node.body);
        return;
      case 'RepeatStatement':
        this.unused(() => this.expression(node.count));
        this.statement(node.body);
        return;
      case 'WithStatement':
        return this.withStatement(node);
      case 'SwitchStatement':
        this.unused(() => this.expression(node.discriminant));
        for (const c of node.cases) {
          if (c.test) this.unused(() => this.expression(c.test!));
          c.body.forEach((s) => this.statement(s));
        }
        return;
      case 'TryStatement': {
        this.statement(node.block);
        if (node.handler) {
          const catchLocal = this.ownShape(
            ids.local(`catch@${this.fileId}:${node.handler.start}`),
            'local',
            { parents: [this.frame.local] },
          );
          this.frames.push({ ...this.frame, local: catchLocal.id });
          this.pushScope(node.handler.start, node.handler.end);
          if (node.handler.param) {
            const param = node.handler.param;
            const symbol = this.declareLocal(catchLocal.id, param.name, param, {
              declaredType: [{ kind: 'Struct', name: 'Exception' }],
            });
            this.ref(param, symbol);
          }
          this.statement(node.handler.body);
          this.flushDocVariables(node.handler.end);
          this.frames.pop();
        }
        if (node.finalizer) this.statement(node.finalizer);
        return;
      }
      case 'ReturnStatement': {
        const type = node.argument
          ? this.used(() => this.expression(node.argument!))
          : [T.undefined];
        this.frame.fn?.returns.push(...type);
        return;
      }
      case 'ThrowStatement':
        this.unused(() => this.expression(node.argument));
        return;
      case 'FunctionDeclaration':
        this.functionDeclaration(node);
        return;
      case 'EnumDeclaration':
        return this.enumDeclaration(node);
      case 'MacroDeclaration': {
        const type = node.body
          ? this.used(() => this.expression(node.body!))
          : [];
        const statementLike = /;\s*$/.test(
          this.text.slice(node.bodyStart, node.bodyEnd),
        );
        const symbol = this.contribute({
          shape: ids.globalShape,
          name: node.name.name,
          start: node.name.start,
          end: node.name.end,
          priority: node.config ? 1 : 0,
          kind: 'macro',
          inferredType: statementLike ? [T.undefined] : normalizeInferred(type),
          description: docDescription(this.docAt(node.start)),
          writable: false,
        });
        this.checkNativeShadow(node.name);
        this.ref(node.name, symbol);
        return;
      }
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'ExitStatement':
      case 'EmptyStatement':
      case 'ErrorStatement':
        return;
    }
  }

  protected checkNativeShadow(name: Identifier) {
    const existing = this.natives
      .getShape(ids.globalShape)
      ?.members.get(name.name);
    if (existing) {
      this.diagnostic(
        'shadowed-native',
        'warning',
        `"${name.name}" already exists as a built-in symbol.`,
        name,
      );
    }
  }

  protected variableDeclaration(
    node: Extract<Statement, { kind: 'VariableDeclaration' }>,
  ) {
    const doc = this.docAt(node.start);
    for (const [i, declarator] of node.declarators.entries()) {
      const name = declarator.name;
      const docs = i === 0 ? doc : undefined;
      const valueType = declarator.init
        ? this.valueExpression(declarator.init, { name: name.name, doc: docs })
        : undefined;
      const declaredType = this.docType(docTag(docs, 'type'));
      if (node.keyword === 'globalvar') {
        const symbol = this.contribute({
          shape: ids.globalShape,
          name: name.name,
          start: name.start,
          end: name.end,
          priority: 0,
          kind: 'variable',
          declaredType,
          inferredType: valueType,
          description: docDescription(docs),
        });
        this.checkNativeShadow(name);
        this.ref(name, symbol, { write: true });
      } else if (node.keyword === 'static') {
        // Statics belong to the constructor's struct, or to the function
        const fn = this.frame.fn?.entry;
        const shape =
          fn?.isConstructor && fn.constructs ? fn.constructs : this.frame.local;
        let symbol: SymbolEntry;
        if (shape === this.frame.local) {
          symbol = this.declareLocal(shape, name.name, name, {
            declaredType,
            inferredType: valueType,
            description: docDescription(docs),
          });
          symbol.static = true;
        } else {
          symbol = this.contribute({
            shape,
            name: name.name,
            start: name.start,
            end: name.end,
            priority: 0,
            kind: this.kindForValue(valueType),
            declaredType,
            inferredType: valueType,
            description: docDescription(docs),
            static: true,
            instance: true,
            fn:
              declarator.init?.kind === 'FunctionExpression'
                ? this.functionIdOf(valueType)
                : undefined,
          });
        }
        this.ref(name, symbol, { write: true });
      } else {
        const existing = this.findMember(this.frame.local, name.name);
        const symbol =
          existing ??
          this.declareLocal(this.frame.local, name.name, name, {
            declaredType,
            inferredType: valueType,
            description: docDescription(docs),
          });
        if (existing && isUntyped(existing.type) && valueType) {
          existing.type = valueType;
        }
        this.ref(name, symbol, { write: true });
      }
    }
  }

  protected declareLocal(
    shape: ShapeId,
    name: string,
    at: { start: number; end: number },
    extra?: {
      declaredType?: TypeUnion;
      inferredType?: TypeUnion;
      description?: string;
    },
  ): SymbolEntry {
    if (!this.ownedShapes.has(shape)) this.ownShape(shape, 'local');
    return this.ownSymbol({
      id: ids.member(shape, name),
      name,
      owner: shape,
      kind: 'variable',
      def: { file: this.fileId, start: at.start, end: at.end },
      type: extra?.declaredType ?? extra?.inferredType ?? [],
      description: extra?.description,
      local: true,
      writable: true,
    });
  }

  protected kindForValue(type: TypeUnion | undefined): SymbolKind {
    const fn = type?.find((t) => t.kind === 'Function');
    if (!fn) return 'variable';
    return this.functionOfType(fn)?.isConstructor ? 'constructor' : 'function';
  }

  /** The function entity among some types, if any */
  protected functionIdOf(types: TypeUnion | undefined): FunctionId | undefined {
    const fn = types?.find(
      (t) => t.kind === 'Function' && (t.entity || t.name),
    );
    return fn?.entity ?? (fn?.name ? ids.fn(fn.name) : undefined);
  }

  protected withStatement(node: Extract<Statement, { kind: 'WithStatement' }>) {
    const doc = this.docAt(node.start);
    const targetType = this.used(() => this.expression(node.target));
    const fromDoc = this.docType(docTag(doc, 'self'));
    const known =
      ofKind(fromDoc, ...withableKinds)[0] ??
      targetType.find((t) => withableKinds.has(t.kind));
    // `with` on a value of unknown type: some instance
    const self = known ?? T.instance;
    this.frames.push({
      ...this.frame,
      kind: 'with',
      self,
      selfShape: this.shapeOfType(self),
      definitive: undefined,
      own: undefined,
      callerSelf: !known,
    });
    this.pushScope(node.body.start, node.body.end);
    this.statement(node.body);
    this.flushDocVariables(node.body.end);
    this.frames.pop();
  }

  protected enumDeclaration(
    node: Extract<Statement, { kind: 'EnumDeclaration' }>,
  ) {
    const shapeId = ids.enumShape(node.name.name);
    const doc = this.docAt(node.start);
    const symbol = this.contribute({
      shape: ids.globalShape,
      name: node.name.name,
      start: node.name.start,
      end: node.name.end,
      priority: 0,
      kind: 'enum',
      declaredType: [{ kind: 'Enum', name: node.name.name }],
      shapeRef: shapeId,
      description: docDescription(doc),
      writable: false,
    });
    this.checkNativeShadow(node.name);
    this.ref(node.name, symbol);
    for (const [idx, member] of node.members.entries()) {
      if (member.init) this.expression(member.init);
      const memberSymbol = this.contribute({
        shape: shapeId,
        name: member.name.name,
        start: member.name.start,
        end: member.name.end,
        priority: 0,
        kind: 'enumMember',
        declaredType: [
          { kind: 'EnumMember', name: `${node.name.name}.${member.name.name}` },
        ],
        description: docDescription(this.docAt(member.start)),
        writable: false,
        idx,
      });
      this.ref(member.name, memberSymbol);
    }
  }

  /** Handle an assignment. Returns the assigned symbol, if any. */
  protected assignment(node: Assignment, doc: DocComment | undefined) {
    const declaredType = this.docType(docTag(doc, 'type'));
    const description = docDescription(doc);
    const declares = node.operator === '=';
    const target = node.target;
    if (target.kind === 'Identifier') {
      const name = target.name;
      if (!name) {
        this.expression(node.value);
        return;
      }
      const isFunction = node.value.kind === 'FunctionExpression';
      // Assigning a function makes a new member (overriding any inherited one)
      const existing = this.resolveIdentifier(name, {
        excludeGlobal: isFunction,
        ownOnly: isFunction,
      });
      if (existing) {
        const valueType = this.valueExpression(node.value, {
          name,
          symbol: existing,
          declaredType,
          doc,
        });
        this.ref(target, existing, { write: true });
        // Record the assignment on the owning shape (instance/struct members)
        if (
          declares &&
          !existing.local &&
          !existing.native &&
          existing.owner !== ids.globalShape
        ) {
          this.contribute({
            shape: existing.owner,
            name,
            start: target.start,
            end: target.end,
            priority: this.priorityFor(existing.owner),
            kind: this.kindForValue(valueType),
            declaredType,
            inferredType: valueType,
            description,
            instance: true,
            fn: isFunction ? this.functionIdOf(valueType) : undefined,
          });
        } else if (existing.local && valueType.length) {
          // Locals accumulate the types assigned to them
          existing.type =
            declaredType ??
            union(
              existing.type.filter((t) => !isUntyped([t])),
              valueType,
            );
        } else if (
          declares &&
          existing.owner === ids.globalShape &&
          !existing.native
        ) {
          this.contribute({
            shape: ids.globalShape,
            name,
            start: target.start,
            end: target.end,
            priority: 2,
            kind: existing.kind,
            declaredType,
            inferredType: valueType,
          });
        }
        return existing;
      }
      const selfShape = this.frame.selfShape;
      if (!selfShape) {
        // Assigning to an undeclared variable in the global scope
        this.valueExpression(node.value, { name, doc });
        if (!this.isAutoDeclared(name)) {
          this.diagnostic(
            'undeclared-global',
            'warning',
            `${name} is not declared anywhere but is assigned in global scope.`,
            target,
          );
        }
        this.ref(target, ids.global(name), { implicit: true, write: true });
        return;
      }
      if (!declares || this.frame.callerSelf) {
        // (In script functions, it's the caller's variable)
        this.valueExpression(node.value, { name, doc });
        this.ref(target, ids.member(selfShape, name), {
          implicit: true,
          write: true,
        });
        return;
      }
      if (this.table.getShape(selfShape)?.readonly) {
        this.expression(node.value);
        this.diagnostic(
          'invalid-operation',
          'warning',
          'Cannot add variables to this type.',
          target,
        );
        return;
      }
      const valueType = this.valueExpression(node.value, {
        name,
        owner: selfShape,
        declaredType,
        doc,
      });
      const symbol = this.contribute({
        shape: selfShape,
        name,
        start: target.start,
        end: target.end,
        priority: this.priorityFor(selfShape),
        kind: this.kindForValue(valueType),
        declaredType,
        inferredType: valueType,
        description,
        instance: true,
        fn: isFunction ? this.functionIdOf(valueType) : undefined,
      });
      this.ref(target, symbol, { write: true });
      return symbol;
    }
    if (target.kind === 'MemberExpression') {
      return this.memberAssignment(node, target, {
        declaredType,
        description,
        declares,
        doc,
      });
    }
    // Index expressions and anything else
    this.expression(target);
    this.expression(node.value);
    return undefined;
  }

  protected memberAssignment(
    node: Assignment,
    target: MemberExpression,
    info: {
      declaredType?: Type[];
      description?: string;
      declares: boolean;
      doc?: DocComment;
    },
  ) {
    const objectType = this.used(() => this.expression(target.object));
    const name = target.property.name;
    const dotScope = this.dotScope(target, objectType);
    if (!name) {
      this.expression(node.value);
      return;
    }
    const { shape, dottable, isEnum } = dotScope;
    const existing = shape ? this.findMember(shape, name) : undefined;
    const isFunction = node.value.kind === 'FunctionExpression';
    if (existing && !isEnum) {
      const valueType = this.valueExpression(node.value, {
        name,
        symbol: existing,
        owner: shape,
        declaredType: info.declaredType,
        doc: info.doc,
      });
      this.ref(target.property, existing, { write: true });
      if (info.declares && !existing.native && shape) {
        this.contribute({
          shape: existing.owner,
          name,
          start: target.property.start,
          end: target.property.end,
          priority: this.priorityFor(existing.owner),
          kind:
            existing.kind === 'variable'
              ? this.kindForValue(valueType)
              : existing.kind,
          declaredType: info.declaredType,
          inferredType: valueType,
          description: info.description,
          instance: existing.owner !== ids.globalShape || undefined,
          fn: isFunction ? this.functionIdOf(valueType) : undefined,
        });
      }
      return existing;
    }
    if (isEnum) {
      this.expression(node.value);
      this.diagnostic(
        'invalid-operation',
        'warning',
        'Undefined enum member.',
        target.property,
      );
      return;
    }
    if (!shape || !dottable) {
      this.expression(node.value);
      return;
    }
    if (shape === ids.instanceBase) {
      // An instance of unknown type: the variable may well exist
      this.valueExpression(node.value, { name, doc: info.doc });
      this.ref(target.property, ids.member(shape, name), {
        implicit: true,
        write: true,
      });
      return;
    }
    if (this.table.getShape(shape)?.readonly) {
      this.expression(node.value);
      this.diagnostic(
        'invalid-operation',
        'warning',
        'Cannot add variables to this type.',
        target.property,
      );
      return;
    }
    const valueType = this.valueExpression(node.value, {
      name,
      owner: shape,
      declaredType: info.declaredType,
      doc: info.doc,
    });
    if (!info.declares) {
      this.ref(target.property, ids.member(shape, name), {
        implicit: true,
        write: true,
      });
      return;
    }
    const isGlobal = shape === ids.globalShape;
    const viaGlobalKeyword =
      target.object.kind === 'Identifier' && target.object.name === 'global';
    if (isGlobal && !viaGlobalKeyword) {
      // e.g. `self.x = ...` where `self` is the global scope
      if (!this.isAutoDeclared(name)) {
        this.diagnostic(
          'undeclared-global',
          'warning',
          `${name} is not declared anywhere but is assigned in global scope.`,
          target.property,
        );
      }
      this.ref(target.property, ids.global(name), {
        implicit: true,
        write: true,
      });
      return;
    }
    const symbol = this.contribute({
      shape,
      name,
      start: target.property.start,
      end: target.property.end,
      priority: isGlobal ? 1 : this.priorityFor(shape),
      kind: this.kindForValue(valueType),
      declaredType: info.declaredType,
      inferredType: valueType,
      description: info.description,
      instance: !isGlobal || undefined,
      fn: isFunction ? this.functionIdOf(valueType) : undefined,
    });
    this.ref(target.property, symbol, { write: true });
    return symbol;
  }

  /**
   * Check the value assigned to a name, giving functions and structs
   * stable ids based on what they're assigned to.
   */
  protected valueExpression(
    value: Expression,
    ctx: {
      name: string;
      symbol?: SymbolEntry;
      owner?: ShapeId;
      declaredType?: Type[];
      doc?: DocComment;
    },
  ): Type[] {
    const key =
      ctx.symbol?.id ??
      (ctx.owner ? ids.member(ctx.owner, ctx.name) : undefined);
    if (value.kind === 'FunctionExpression') {
      const fn = this.functionExpression(value, {
        key,
        name: value.name?.name ?? ctx.name,
        self:
          ctx.owner && ctx.owner !== this.frame.selfShape
            ? this.typeForShape(ctx.owner)
            : undefined,
        doc: ctx.doc,
      });
      return [fn];
    }
    if (value.kind === 'StructLiteral') {
      return [this.structLiteral(value, key)];
    }
    const type = this.used(() => this.expression(value));
    return normalizeInferred(type);
  }

  protected typeForShape(shape: ShapeId): Type | undefined {
    if (shape.startsWith('obj:'))
      return { kind: 'Id.Instance', name: shape.slice(4) };
    if (shape === ids.globalShape) return undefined;
    return { kind: 'Struct', entity: shape };
  }

  //#endregion

  //#region Functions

  /** A stable id for a function entity */
  protected functionIdFor(
    node: FunctionDeclaration | FunctionExpression,
    key: string | undefined,
  ): FunctionId {
    if (node.kind === 'FunctionDeclaration' && this.isGlobalFunction(node)) {
      return ids.fn(node.name.name);
    }
    if (key) return ids.fn(key);
    return `fn@${this.fileId}:${node.start}`;
  }

  protected isGlobalFunction(node: FunctionDeclaration): boolean {
    return this.globalFunctionNodes.has(node);
  }

  protected functionDeclaration(node: FunctionDeclaration) {
    const name = node.name;
    if (this.isGlobalFunction(node)) {
      const type = this.functionExpression(node, {
        key: undefined,
        name: name.name,
        doc: this.docAt(node.start),
      });
      const fn = this.ownedFunctions.get(ids.fn(name.name))!;
      const symbol = this.contribute({
        shape: ids.globalShape,
        name: name.name,
        start: name.start,
        end: name.end,
        priority: 0,
        kind: node.isConstructor ? 'constructor' : 'function',
        declaredType: [type],
        fn: fn.id,
        shapeRef: fn.constructs,
        description: fn.description,
        deprecated: fn.deprecated,
        mixin: fn.mixin,
        writable: false,
      });
      this.checkNativeShadow(name);
      this.ref(name, symbol);
      return;
    }
    // Elsewhere, a function declaration makes a method on `self` (which may
    // be the global scope)
    const selfShape =
      this.frame.selfShape && this.frame.selfShape !== ids.instanceBase
        ? this.frame.selfShape
        : ids.globalShape;
    const doc = this.docAt(node.start);
    const owner = selfShape;
    const key = ids.member(owner, name.name);
    const type = this.functionExpression(node, { key, name: name.name, doc });
    let symbol: SymbolEntry;
    if (selfShape) {
      symbol = this.contribute({
        shape: selfShape,
        name: name.name,
        start: name.start,
        end: name.end,
        priority:
          selfShape === ids.globalShape ? 1 : this.priorityFor(selfShape),
        kind: node.isConstructor ? 'constructor' : 'function',
        declaredType: [type],
        fn: this.functionIdOf([type]),
        description: docDescription(doc),
        instance: true,
      });
    } else {
      symbol = this.declareLocal(owner, name.name, name, {
        declaredType: [type],
        description: docDescription(doc),
      });
      symbol.fn = this.functionIdOf([type]);
      symbol.kind = node.isConstructor ? 'constructor' : 'function';
    }
    this.ref(name, symbol);
  }

  /**
   * Check a function's signature and body. Returns its type.
   */
  protected functionExpression(
    node: FunctionDeclaration | FunctionExpression,
    ctx: {
      key: string | undefined;
      name?: string;
      /** The `self` the function will run in, if not the current one */
      self?: Type;
      doc: DocComment | undefined;
    },
  ): Type {
    const doc = ctx.doc ?? this.docAt(node.start);
    const fnId = this.functionIdFor(node, ctx.key);
    const name =
      node.kind === 'FunctionDeclaration'
        ? node.name.name
        : (node.name?.name ?? ctx.name);
    const localId = ids.local(fnId);
    const local = this.ownShape(localId, 'local');
    // Templates
    const generics = new Map<string, Type>();
    for (const tag of docTags(doc, 'template')) {
      if (!tag.name) continue;
      const constraint = this.docType(tag)?.[0];
      generics.set(tag.name.name, {
        ...(constraint ?? T.any),
        name: tag.name.name,
        generic: true,
      });
    }
    const isMixin = !!docTag(doc, 'mixin');
    const entry = this.ownFunction({
      id: fnId,
      name,
      params: [],
      returns: [],
      isConstructor: node.isConstructor,
      local: localId,
      templates: generics.size ? [...generics.keys()] : undefined,
      mixin: isMixin || undefined,
      description: docDescription(doc),
      deprecated: docTag(doc, 'deprecated') ? true : undefined,
    });

    // The struct a constructor creates
    if (node.isConstructor) {
      const isGlobalConstructor =
        node.kind === 'FunctionDeclaration' && this.isGlobalFunction(node);
      const shapeId = isGlobalConstructor
        ? ids.structShape(node.name.name)
        : `struct:${fnId}`;
      const parents: ShapeId[] = [];
      if (node.parent) {
        const parentName = node.parent.name;
        const parentSymbol = this.findMember(ids.globalShape, parentName.name);
        if (parentSymbol) this.ref(parentName, parentSymbol);
        else
          this.ref(parentName, ids.global(parentName.name), { implicit: true });
        parents.push(ids.structShape(parentName.name));
        node.parent.args.forEach((a) => this.argumentExpression(a));
      }
      const shape = this.ownShape(shapeId, 'struct', { name, parents });
      shape.symbol = isGlobalConstructor
        ? ids.global(node.name.name)
        : undefined;
      entry.constructs = shape.id;
      entry.self = {
        kind: 'Struct',
        name: isGlobalConstructor ? name : undefined,
        entity: shape.id,
      };
    }

    // The `self` the body runs in
    const docSelf = this.docType(docTag(doc, 'self'), generics)?.[0];
    // Script functions run as whatever instance calls them
    const callerSelf =
      node.kind === 'FunctionDeclaration' &&
      this.isGlobalFunction(node) &&
      !node.isConstructor &&
      !docSelf &&
      !isMixin;
    let self: Type | undefined;
    if (node.isConstructor) self = entry.self;
    else if (callerSelf) self = T.instance;
    else if (docSelf) {
      const docFn = this.functionOfType(docSelf);
      self = docFn
        ? docFn.isConstructor
          ? { kind: 'Struct', entity: docFn.constructs }
          : docFn.self
        : docSelf;
    } else if (ctx.self) self = ctx.self;
    else if (isMixin) {
      const mixinShape = this.ownShape(`mixin:${fnId}`, 'struct', { name });
      entry.mixinShape = mixinShape.id;
      self = { kind: 'Struct', entity: mixinShape.id };
    } else self = this.frame.self;
    if (self && !withableKinds.has(self.kind)) self = this.frame.self;
    entry.self = callerSelf ? undefined : self;
    const selfShape = this.shapeOfType(self);

    // Parameters
    const paramDocs = docTags(doc, 'param');
    const params: string[] = [];
    for (const [idx, param] of node.params.entries()) {
      const paramName = param.name.name;
      let paramDoc: DocTag | undefined = paramDocs[idx];
      if (paramDoc?.name && paramDoc.name.name !== paramName) {
        // Matched by name instead of position?
        const byName = paramDocs.find((d) => d.name?.name === paramName);
        // A doc name that matches no parameter suggests a typo or rename
        // (legacy `argumentN` params are usually documented by meaning)
        const docNameUnused = !node.params.some(
          (p) => p.name.name === paramDoc!.name!.name,
        );
        if (!byName && docNameUnused && !/^argument\d+$/.test(paramName)) {
          this.diagnostic(
            'jsdoc-mismatch',
            'warning',
            `Parameter \`${paramName}\` is documented as \`${paramDoc.name.name}\``,
            param.name,
          );
        }
        paramDoc = byName;
      }
      const defaultType = param.defaultValue
        ? this.used(() => this.expression(param.defaultValue!))
        : undefined;
      const symbol = this.ownSymbol({
        id: ids.member(localId, paramName),
        name: paramName,
        owner: localId,
        kind: 'parameter',
        def: {
          file: this.fileId,
          start: param.name.start,
          end: param.name.end,
        },
        type:
          this.docType(paramDoc, generics) ??
          (defaultType ? normalizeInferred(defaultType) : [T.any]),
        description: paramDoc?.description?.text || undefined,
        parameter: true,
        local: true,
        idx,
        optional: paramDoc?.name?.optional || !!param.defaultValue || undefined,
        writable: true,
      });
      local.members.set(paramName, symbol.id);
      params.push(symbol.id);
      this.ref(param.name, symbol);
      if (paramDoc?.name) this.ref(this.nameSpan(paramDoc.name), symbol);
    }
    // Extra documented params (e.g. for functions that use `argument[n]`)
    for (let idx = node.params.length; idx < paramDocs.length; idx++) {
      const paramDoc = paramDocs[idx];
      if (!paramDoc.name) continue;
      const paramName = paramDoc.name.name;
      const symbol = this.ownSymbol(
        {
          // Documented-only params aren't variables: give them ids that can't
          // collide with locals of the same name
          id: ids.member(localId, `#${idx}`),
          name: paramDoc.name.rest ? '...' : paramName,
          owner: localId,
          kind: 'parameter',
          def: { file: this.fileId, ...this.nameSpan(paramDoc.name) },
          type: this.docType(paramDoc, generics) ?? [T.any],
          description: paramDoc.description?.text || undefined,
          parameter: true,
          local: true,
          idx,
          optional: paramDoc.name.optional || paramDoc.name.rest || undefined,
          writable: true,
        },
        { hidden: true },
      );
      params.push(symbol.id);
      if (paramDoc.name.rest) entry.variadic = true;
      this.ref(this.nameSpan(paramDoc.name), symbol);
    }
    entry.params = params;

    // Body
    const returns: Type[] = [];
    this.frames.push({
      kind: 'function',
      local: localId,
      self,
      selfShape,
      definitive: node.isConstructor || isMixin ? selfShape : undefined,
      own: node.isConstructor || isMixin ? selfShape : this.frame.own,
      fn: { returns, entry },
      callerSelf:
        callerSelf ||
        (this.frame.callerSelf && !node.isConstructor && !docSelf && !isMixin),
    });
    const open = this.tokenAfter(
      '(',
      node.kind === 'FunctionDeclaration' ? node.name.end : node.start,
      node.body.start,
    );
    this.pushScope(open ? open.end : node.body.start, node.body.end);
    this.statement(node.body);
    this.flushDocVariables(node.body.end);
    this.frames.pop();

    const docReturns = this.docType(docTag(doc, 'returns'), generics);
    entry.returns = node.isConstructor
      ? [entry.self!]
      : (docReturns ??
        (returns.length ? union(normalizeInferred(returns)) : [T.undefined]));
    // Global functions are found by name, like the declarations pass does
    return this.isNamedGlobal(fnId)
      ? { kind: 'Function', name }
      : { kind: 'Function', entity: fnId };
  }

  protected isNamedGlobal(fnId: FunctionId): boolean {
    return /^fn:[A-Za-z_]\w*$/.test(fnId);
  }

  //#endregion

  //#region Expressions

  protected expression(node: Expression): Type[] {
    switch (node.kind) {
      case 'Identifier':
        return this.identifier(node);
      case 'Literal':
        switch (node.literalKind) {
          case 'number':
            return [T.real];
          case 'string':
          case 'rawString':
            return [T.string];
          case 'boolean':
            return [T.bool];
          default:
            return [T.undefined];
        }
      case 'TemplateString':
        for (const part of node.parts) {
          if (part.kind !== 'TemplateText') this.expression(part);
        }
        return [T.string];
      case 'ArrayLiteral': {
        const items = union(
          ...node.elements.map((e) => normalizeInferred(this.expression(e))),
        );
        return [items.length ? { kind: 'Array', items } : T.array];
      }
      case 'StructLiteral':
        return [this.structLiteral(node, undefined)];
      case 'FunctionExpression':
        return [
          this.functionExpression(node, { key: undefined, doc: undefined }),
        ];
      case 'ParenthesizedExpression':
        return this.expression(node.expression);
      case 'UnaryExpression':
        this.expression(node.argument);
        return node.operator === '!'
          ? [T.bool]
          : node.operator === 'delete'
            ? [T.undefined]
            : [T.real];
      case 'UpdateExpression':
        this.expression(node.argument);
        return [T.real];
      case 'BinaryExpression': {
        const left = this.expression(node.left);
        const right = this.expression(node.right);
        if (numericOperators.has(node.operator)) return [T.real];
        if (booleanOperators.has(node.operator)) return [T.bool];
        if (node.operator === '+') {
          if (ofKind(left, 'String').length || ofKind(right, 'String').length)
            return [T.string];
          return left.length ? left : [T.real];
        }
        if (node.operator === '??') {
          return union(
            left.filter((t) => t.kind !== 'Undefined'),
            right,
          );
        }
        return left;
      }
      case 'ConditionalExpression':
        this.expression(node.test);
        return union(
          this.expression(node.consequent),
          this.expression(node.alternate),
        );
      case 'MemberExpression':
        return this.memberExpression(node);
      case 'IndexExpression': {
        const objectType = this.expression(node.object);
        node.indices.forEach((i) => this.expression(i));
        const kind =
          node.accessor === 'map'
            ? 'Id.DsMap'
            : node.accessor === 'list'
              ? 'Id.DsList'
              : node.accessor === 'grid'
                ? 'Id.DsGrid'
                : node.accessor === 'struct'
                  ? 'Struct'
                  : 'Array';
        return union(...ofKind(objectType, kind).map((t) => t.items ?? []));
      }
      case 'CallExpression':
        return this.call(node);
      case 'NewExpression':
        return this.call(node);
      case 'MissingExpression':
        return [T.any];
    }
  }

  protected isAutoDeclared(name: string): boolean {
    return !!this.options.autoDeclareGlobalsPrefixes?.some((p) =>
      name.startsWith(p),
    );
  }

  /** Find what a bare name refers to: local, then self, then global */
  protected resolveIdentifier(
    name: string,
    options?: { excludeGlobal?: boolean; ownOnly?: boolean },
  ): SymbolEntry | undefined {
    const frame = this.frame;
    const local = this.findMember(frame.local, name);
    if (local) return local;
    if (frame.selfShape) {
      const member = this.findMember(frame.selfShape, name, {
        ownOnly: options?.ownOnly,
      });
      if (member) return member;
    }
    if (options?.excludeGlobal) return undefined;
    return this.findMember(ids.globalShape, name);
  }

  protected identifier(node: Identifier): Type[] {
    const name = node.name;
    if (!name) return [T.any];
    const frame = this.frame;
    if (name === 'self') {
      if (!frame.selfShape) {
        this.diagnostic(
          'global-self',
          'warning',
          '`self` refers to the global scope here, which is probably unintentional.',
          node,
        );
        return [{ kind: 'Struct', name: 'global' }];
      }
      // (`self` isn't a reference by name, so it isn't recorded as one)
      return frame.self ? [frame.self] : [T.any];
    }
    if (name === 'other') {
      const other = this.otherFrame();
      if (other === 'unknown') return [T.any];
      if (!other.selfShape) {
        this.diagnostic(
          'global-self',
          'warning',
          '`other` refers to the global scope here, which is probably unintentional.',
          node,
        );
        return [{ kind: 'Struct', name: 'global' }];
      }
      return other.self ? [other.self] : [T.any];
    }
    if (name === 'global') {
      return [{ kind: 'Struct', name: 'global' }];
    }
    const symbol = this.resolveIdentifier(name);
    if (symbol) {
      this.ref(node, symbol);
      return this.typeOfSymbol(symbol);
    }
    if (frame.selfShape) {
      // Not declared (yet): an instance/struct variable declared elsewhere, or a typo
      this.ref(node, ids.member(frame.selfShape, name), { implicit: true });
    } else {
      if (!this.isAutoDeclared(name)) {
        this.diagnostic(
          'undeclared-global',
          'warning',
          `${name} looks like a global but is not declared anywhere.`,
          node,
        );
      }
      this.ref(node, ids.global(name), { implicit: true });
    }
    return [T.any];
  }

  /**
   * What `other` refers to: the scope outside the innermost `with`, the
   * other instance in a collision event, or (where it depends on how the
   * code is called) unknown.
   */
  protected otherFrame(): Frame | 'unknown' {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const frame = this.frames[i];
      if (frame.kind === 'with') return this.frames[i - 1] ?? this.fileSelf;
      if (frame.kind === 'function') return 'unknown';
    }
    const file = this.pf.file;
    const collision = file.event?.match(/^Collision_(.+)$/)?.[1];
    if (collision) {
      return {
        local: this.fileSelf.local,
        self: { kind: 'Id.Instance', name: collision },
        selfShape: ids.objectShape(collision),
      };
    }
    // In other events, `other` depends on how the event was triggered
    if (file.kind === 'objectEvent' || file.kind === 'instanceCreation')
      return 'unknown';
    return this.fileSelf;
  }

  /** Work out the shape that `object.` gives access to, recording a dot scope */
  protected dotScope(node: MemberExpression, objectType: Type[]) {
    const dottable = objectType.filter(
      (t) =>
        withableKinds.has(t.kind) ||
        t.kind === 'Enum' ||
        (t.kind === 'Struct' && t.name === 'global'),
    );
    let chosen = dottable[0];
    const name = node.property.name;
    if (dottable.length > 1 && name) {
      chosen =
        dottable.find((t) => {
          const shape = this.shapeOfType(t);
          return shape && this.findMember(shape, name);
        }) ?? chosen;
    }
    const shape = this.shapeOfType(chosen);
    // Completions after the dot
    const dotEnd = node.property.start;
    const dot = this.tokens[tokenIndexAt(this.tokens, node.object.end)];
    const dotStart = dot && dot.start < dotEnd ? dot.end : dotEnd;
    this.frames.push({
      ...this.frame,
      self: chosen ?? T.any,
      selfShape: shape,
    });
    this.pushScope(dotStart, Math.max(node.property.end, dotStart), true);
    this.frames.pop();
    // (Variables are often initialized to `undefined`, so that's allowed)
    const known = objectType.filter((t) => t.kind !== 'Undefined');
    if (!chosen && known.length && !isUntyped(known)) {
      this.diagnostic(
        'invalid-operation',
        'warning',
        'Type does not allow dot accessors.',
        node.property.name ? node.property : node,
      );
    }
    return { shape, dottable: !!chosen, isEnum: chosen?.kind === 'Enum' };
  }

  protected memberExpression(node: MemberExpression): Type[] {
    const objectType = this.used(() => this.expression(node.object));
    const { shape, dottable, isEnum } = this.dotScope(node, objectType);
    const name = node.property.name;
    if (!name || !dottable || !shape) return [T.any];
    const member = this.findMember(shape, name);
    if (member) {
      this.ref(node.property, member);
      return this.typeOfSymbol(member);
    }
    if (isEnum) {
      this.diagnostic(
        'invalid-operation',
        'warning',
        'Undefined enum member.',
        node.property,
      );
      return [T.any];
    }
    this.ref(node.property, ids.member(shape, name), { implicit: true });
    return [T.any];
  }

  protected structLiteral(node: StructLiteral, key: string | undefined): Type {
    const shapeId = key
      ? `struct:${key}`
      : `struct@${this.fileId}:${node.start}`;
    const shape = this.ownShape(shapeId, 'struct');
    // Completion ranges for new members: after `{` and each `,`
    const delimiters = this.delimiters(node.start);
    for (let i = 0; i < delimiters.length - 1; i++) {
      const [open, close] = [delimiters[i], delimiters[i + 1]];
      const property = node.properties.find(
        (p) => p.start >= open.end && p.start <= close.start,
      );
      this.out.structMemberRanges.push({
        start: open.end,
        end: property ? property.key.end : close.start,
        shape: shape.id,
      });
    }
    for (const property of node.properties) {
      const doc = this.docAt(property.start);
      const keyNode = property.key;
      const name =
        keyNode.kind === 'Identifier' ? keyNode.name : stringValue(keyNode.raw);
      if (!name) continue;
      const span = { start: keyNode.start, end: keyNode.end };
      if (!property.value) {
        // Shorthand: `{name}` uses the variable `name`
        const variable = this.resolveIdentifier(name);
        if (!variable) {
          this.diagnostic(
            'invalid-operation',
            'warning',
            `Struct literal shorthand requires an existing variable named "${name}"`,
            span,
          );
          continue;
        }
        this.ref(span, variable);
        this.contribute({
          shape: shape.id,
          name,
          ...span,
          priority: 0,
          kind:
            variable.kind === 'parameter' || variable.local
              ? 'variable'
              : variable.kind,
          inferredType: variable.type,
          fn: variable.fn,
          instance: true,
        });
        continue;
      }
      const declaredType = this.docType(docTag(doc, 'type'));
      const valueType = this.valueExpression(property.value, {
        name,
        owner: shape.id,
        declaredType,
        doc,
      });
      const symbol = this.contribute({
        shape: shape.id,
        name,
        ...span,
        priority: 0,
        kind: this.kindForValue(valueType),
        declaredType,
        inferredType: valueType,
        description: docDescription(doc),
        fn:
          property.value.kind === 'FunctionExpression'
            ? this.functionIdOf(valueType)
            : undefined,
        instance: true,
      });
      this.ref(span, symbol);
    }
    return { kind: 'Struct', entity: shape.id };
  }

  /** The first token of a kind at or after an offset (and before `before`) */
  protected tokenAfter(
    kind: string,
    offset: number,
    before = Infinity,
  ): Token | undefined {
    for (
      let i = tokenIndexAt(this.tokens, offset);
      i < this.tokens.length;
      i++
    ) {
      const token = this.tokens[i];
      if (token.start >= before) return undefined;
      if (token.kind === kind) return token;
    }
    return undefined;
  }

  /**
   * Given the offset of an opening bracket: the bracket itself, the commas
   * directly inside it, and its closing bracket.
   */
  protected delimiters(openOffset: number): Token[] {
    const start = tokenIndexAt(this.tokens, openOffset);
    const open = this.tokens[start];
    if (!open || !isOpener(open.kind)) return [];
    const result: Token[] = [open];
    let depth = 1;
    for (let i = start + 1; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (isOpener(token.kind)) depth++;
      else if (isCloser(token.kind)) {
        if (--depth === 0) {
          result.push(token);
          return result;
        }
      } else if (token.kind === ',' && depth === 1) result.push(token);
    }
    return result;
  }

  protected argumentExpression(arg: Argument, ctx?: { self?: Type }): Type[] {
    if (arg.kind === 'OmittedArgument') return [T.undefined];
    if (arg.kind === 'FunctionExpression') {
      return [
        this.functionExpression(arg, {
          key: undefined,
          self: ctx?.self,
          doc: this.docAt(arg.start),
        }),
      ];
    }
    return this.expression(arg);
  }

  protected call(node: CallExpression | NewExpression): Type[] {
    const calleeType = this.used(() => this.expression(node.callee));
    const fn = calleeType.map((t) => this.functionOfType(t)).find((f) => f);
    if (
      node.callee.kind === 'Identifier' &&
      node.callee.name === 'event_inherited'
    ) {
      this.out.callsInherited = true;
    }
    const isMethod =
      fn?.id === ids.fn('method') && fn.symbol === ids.global('method');
    // Mixins add their variables to the caller
    if (fn?.mixin && fn.mixinShape && this.frame.selfShape) {
      for (const member of this.table.listMembers(fn.mixinShape, this.deps)) {
        if (!member.def) continue;
        // (Contribute even if the alias is already there, so it persists)
        const current = this.findMember(this.frame.selfShape, member.name);
        if (current?.native) continue;
        this.contribute({
          shape: this.frame.selfShape,
          name: member.name,
          start: node.callee.start,
          end: node.callee.end,
          priority: this.priorityFor(this.frame.selfShape),
          kind: member.kind,
          alias: member.id,
        });
      }
    }
    // Arguments, and the ranges between delimiters for signature help
    const open = this.tokens[tokenIndexAt(this.tokens, node.callee.end)];
    const delimiters = open?.kind === '(' ? this.delimiters(open.start) : [];
    const ranges: ArgumentRange[] = [];
    const generics = new Map<string, Type[]>();
    let methodSelf: Type | undefined;
    let methodReturns: Type[] | undefined;
    for (const [idx, arg] of node.args.entries()) {
      const param = this.table.getSymbol(fn?.params[idx]);
      const self = isMethod && idx === 1 ? methodSelf : undefined;
      const affectsResult = isMethod || !!fn?.templates?.length;
      const argType = normalizeInferred(
        affectsResult
          ? this.used(() => this.argumentExpression(arg, { self }))
          : this.unused(() => this.argumentExpression(arg, { self })),
      );
      if (isMethod && idx === 0)
        methodSelf = argType.find((t) => withableKinds.has(t.kind));
      if (isMethod && idx === 1)
        methodReturns = argType.filter((t) => t.kind === 'Function');
      if (param) inferGenerics(param.type, argType, generics);
    }
    if (fn) {
      for (let i = 0; i < delimiters.length - 1; i++) {
        const [a, b] = [delimiters[i], delimiters[i + 1]];
        const arg = node.args[i];
        ranges.push({
          start: a.end,
          end: b.start,
          fn: fn.id,
          idx: i,
          hasExpression: !!arg && arg.kind !== 'OmittedArgument',
        });
      }
      this.out.argumentRanges.push(...ranges);
      if (ranges.length) {
        this.out.calls.push({
          fn: fn.id,
          start: node.start,
          end: node.end,
          args: ranges,
          argCount: node.args.length,
        });
      }
    }
    if (!fn) return [T.any];
    if (node.kind === 'NewExpression') {
      return fn.constructs
        ? [{ kind: 'Struct', name: fn.name, entity: fn.constructs }]
        : [T.struct];
    }
    if (isMethod && methodReturns?.length) return methodReturns;
    // The return type matters only if the call's result is used
    this.readReturns(fn.id);
    return normalizeInferred(substituteGenerics(fn.returns, generics));
  }

  //#endregion
}

/** Resolve utility types and other things inferred types shouldn't contain */
export function normalizeInferred(types: readonly Type[]): Type[] {
  const result: Type[] = [];
  for (const type of types) {
    if (type.kind === 'EnumMember' && type.name?.includes('.')) {
      result.push({ kind: 'Enum', name: type.name.split('.')[0] });
      continue;
    }
    const utility =
      type.kind === 'InstanceType'
        ? 'Id.Instance'
        : type.kind === 'ObjectType'
          ? 'Asset.GMObject'
          : type.kind === 'StaticType'
            ? 'Struct'
            : undefined;
    if (utility) {
      if (!type.items?.length) {
        result.push({ kind: utility });
        continue;
      }
      for (const item of type.items) {
        if (item.generic) {
          result.push({ kind: utility, name: item.name, generic: true });
        } else {
          result.push({
            kind: utility,
            name: item.name,
            entity: utility === 'Struct' ? item.entity : undefined,
          });
        }
      }
      continue;
    }
    result.push(type);
  }
  return union(result);
}

/** Match an expected (possibly generic) type against an actual one */
function inferGenerics(
  expected: readonly Type[],
  actual: readonly Type[],
  generics: Map<string, Type[]>,
) {
  for (const e of expected) {
    if (e.generic && e.name) {
      generics.set(e.name, union(generics.get(e.name), actual));
      continue;
    }
    if (!e.items?.length) continue;
    for (const a of actual) {
      if (a.kind === e.kind && a.items?.length)
        inferGenerics(e.items, a.items, generics);
    }
  }
}

function substituteGenerics(
  types: readonly Type[],
  generics: Map<string, Type[]>,
): Type[] {
  const result: Type[] = [];
  for (const type of types) {
    if (type.generic && type.name) {
      const bound = generics.get(type.name);
      if (bound?.length) result.push(...bound);
      else result.push(T.any);
      continue;
    }
    if (type.items?.length) {
      const items = substituteGenerics(type.items, generics).filter(
        (t) => t.kind !== 'Any' || type.items!.length === 1,
      );
      result.push({ ...type, items: items.length ? items : undefined });
      continue;
    }
    result.push(type);
  }
  return union(result);
}

function stringValue(raw: string): string {
  return raw.replace(/^@?["']|["']$/g, '');
}

function isOpener(kind: string): boolean {
  return kind === '(' || kind === '{' || kind.startsWith('[');
}

function isCloser(kind: string): boolean {
  return kind === ')' || kind === '}' || kind === ']';
}
