/**
 * The analyzer: holds a project's files, builds its symbol table from what
 * the files declare, and keeps everything up to date as files change.
 */
import type { FileAnalysis, MemberContribution } from './analysis.types.ts';
import { Checker, type CheckOptions } from './checker.ts';
import {
  declare,
  parseFile,
  type FileDeclarations,
  type ParsedFile,
  type SourceFile,
} from './file.ts';
import type { NativeTable } from './natives.ts';
import {
  ids,
  SymbolTable,
  type FunctionEntry,
  type ShapeEntry,
  type ShapeId,
  type SymbolEntry,
  type SymbolKind,
} from './symbols.ts';
import { formatType, union, type Type } from './types.ts';

/** An asset in the project */
export interface AssetInfo {
  name: string;
  /** The asset's kind, as in its yy path: `objects`, `sprites`, ... */
  kind: string;
  /** For objects, the parent object's name */
  parent?: string;
}

/** Functions and constants provided by extensions */
export interface ExtensionInfo {
  constants: { name: string; value: string }[];
  functions: {
    name: string;
    externalName: string;
    /** 1 for String, 2 for Real */
    args: number[];
    returnType: number;
    help?: string;
  }[];
}

/** What the analyzer needs to know about the project, besides its code */
export interface ProjectInfo {
  assets: AssetInfo[];
  audioGroups?: string[];
  extensions?: ExtensionInfo[];
}

export interface AnalyzerOptions extends CheckOptions {
  /** Max check passes when settling cross-file inference. @default 6 */
  maxPasses?: number;
}

interface FileState {
  parsed: ParsedFile;
  declarations: FileDeclarations;
  analysis?: FileAnalysis;
}

/** Keys of everything that changed between two versions of the symbol table */
interface ChangeSet {
  members: Map<ShapeId, Set<string>>;
  symbols: Set<string>;
  functions: Set<string>;
}

export interface AnalyzeResult {
  /** Files that were (re)checked */
  checked: Set<string>;
  passes: number;
}

const assetTypeKinds: Record<string, string> = {
  objects: 'Asset.GMObject',
  rooms: 'Asset.GMRoom',
  sprites: 'Asset.GMSprite',
  sounds: 'Asset.GMSound',
  paths: 'Asset.GMPath',
  shaders: 'Asset.GMShader',
  timelines: 'Asset.GMTimeline',
  fonts: 'Asset.GMFont',
  sequences: 'Asset.GMSequence',
  tilesets: 'Asset.GMTileSet',
  animcurves: 'Asset.GMAnimCurve',
  particles: 'Asset.GMParticleSystem',
};

export class GmlAnalyzer {
  readonly natives: NativeTable;
  readonly options: AnalyzerOptions;
  protected project: ProjectInfo = { assets: [] };
  protected readonly files = new Map<string, FileState>();
  protected readonly dirty = new Set<string>();
  protected _table: SymbolTable;

  constructor(natives: NativeTable, options: AnalyzerOptions = {}) {
    this.natives = natives;
    this.options = options;
    this._table = new SymbolTable(natives);
  }

  /** The current project symbol table (layered over the natives) */
  get table(): SymbolTable {
    return this._table;
  }

  setProject(project: ProjectInfo) {
    this.project = project;
    // Object inheritance can change anything
    for (const id of this.files.keys()) this.dirty.add(id);
  }

  /** Add or update a file. Call `analyze()` to bring results up to date. */
  setFile(file: SourceFile, text: string) {
    const existing = this.files.get(file.id);
    const parsed = parseFile(file, text);
    if (
      existing &&
      existing.parsed.hash === parsed.hash &&
      sameFile(existing.parsed.file, file)
    ) {
      return;
    }
    this.files.set(file.id, {
      parsed,
      declarations: declare(parsed),
      analysis: existing?.analysis,
    });
    this.dirty.add(file.id);
  }

  removeFile(id: string) {
    if (!this.files.delete(id)) return;
    this.dirty.delete(id);
    this.removed.add(id);
  }
  protected readonly removed = new Set<string>();

  getFile(id: string): ParsedFile | undefined {
    return this.files.get(id)?.parsed;
  }

  getAnalysis(id: string): FileAnalysis | undefined {
    return this.files.get(id)?.analysis;
  }

  get fileIds(): string[] {
    return [...this.files.keys()];
  }

  /**
   * Bring all analysis results up to date: check changed files, then
   * re-check whatever depended on what changed, until nothing changes.
   */
  analyze(): AnalyzeResult {
    const checked = new Set<string>();
    const maxPasses = this.options.maxPasses ?? 6;
    let passes = 0;
    // Removed files may have declared things others depend on
    if (this.removed.size || this.dirty.size) {
      const before = this._table;
      this._table = this.buildTable();
      if (this.removed.size) {
        this.markDependents(diffTables(before, this._table));
        this.removed.clear();
      }
    }
    while (this.dirty.size && passes < maxPasses) {
      passes++;
      const toCheck = this.checkOrder([...this.dirty]);
      this.dirty.clear();
      const table = this._table;
      for (const id of toCheck) {
        const state = this.files.get(id);
        if (!state) continue;
        state.analysis = new Checker(
          state.parsed,
          { project: table, natives: this.natives },
          this.options,
        ).check();
        checked.add(id);
      }
      this._table = this.buildTable();
      this.markDependents(diffTables(table, this._table));
    }
    this.dirty.clear();
    this._refIndex = undefined;
    this._memberNames = undefined;
    return { checked, passes };
  }

  protected markDependents(changes: ChangeSet) {
    if (
      !changes.members.size &&
      !changes.symbols.size &&
      !changes.functions.size
    ) {
      return;
    }
    for (const [id, state] of this.files) {
      const deps = state.analysis?.deps;
      if (!deps) continue;
      if (dependsOn(deps, changes)) this.dirty.add(id);
    }
  }

  /** Scripts first, then objects (parents before children), then the rest */
  protected checkOrder(ids: string[]): string[] {
    const depth = new Map<string, number>();
    const parents = new Map(
      this.project.assets
        .filter((a) => a.kind === 'objects')
        .map((a) => [a.name, a.parent]),
    );
    const depthOf = (name: string): number => {
      if (depth.has(name)) return depth.get(name)!;
      depth.set(name, 0); // cycle guard
      const parent = parents.get(name);
      const d = parent ? depthOf(parent) + 1 : 0;
      depth.set(name, d);
      return d;
    };
    const rank = (id: string) => {
      const file = this.files.get(id)?.parsed.file;
      if (!file) return [9, 0];
      if (file.kind === 'script') return [0, 0];
      if (file.kind === 'objectEvent') {
        return [1, depthOf(file.asset), file.event === 'Create_0' ? 0 : 1];
      }
      return [2, 0];
    };
    return ids.sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
        const d = (ra[i] ?? 0) - (rb[i] ?? 0);
        if (d) return d;
      }
      return a.localeCompare(b);
    });
  }

  //#region Building the symbol table

  /** Build the project symbol table from assets and every file's contributions */
  protected buildTable(): SymbolTable {
    const table = new SymbolTable(this.natives);
    const global = this.shape(table, ids.globalShape, 'global');
    global.name = 'global';
    this.addAssets(table);

    // Entities owned by files
    for (const state of this.files.values()) {
      const owned = state.analysis?.owned;
      if (!owned) continue;
      for (const shape of owned.shapes) {
        const existing = table.shapes.get(shape.id);
        table.shapes.set(shape.id, {
          ...shape,
          members: new Map([...(existing?.members ?? []), ...shape.members]),
          parents: shape.parents.length
            ? [...shape.parents]
            : (existing?.parents ?? []),
        });
      }
      for (const fn of owned.functions) table.functions.set(fn.id, fn);
      for (const symbol of owned.symbols) table.symbols.set(symbol.id, symbol);
    }

    // Function signatures and constructor inheritance, for files not yet checked
    for (const state of this.files.values()) {
      if (state.analysis) continue;
      for (const fn of state.declarations.functions) {
        if (!table.functions.has(fn.id)) table.functions.set(fn.id, fn);
      }
      for (const g of state.declarations.globals) {
        if (g.kind !== 'constructor') continue;
        const shape = this.shape(table, ids.structShape(g.name), 'struct');
        shape.name = g.name;
        shape.symbol = ids.global(g.name);
        if (g.parent) shape.parents = [ids.structShape(g.parent)];
      }
    }

    // Members contributed by files
    const groups = new Map<string, MemberContribution[]>();
    for (const [id, state] of this.files) {
      const contributions =
        state.analysis?.members ?? seedContributions(id, state);
      for (const c of contributions) {
        const key = `${c.shape}\u0000${c.name}`;
        let group = groups.get(key);
        if (!group) groups.set(key, (group = []));
        group.push(c);
      }
    }
    for (const group of this.resolveInheritance(table, groups)) {
      const { shape: shapeId, name } = group[0];
      if (
        shapeId === ids.globalShape &&
        this.natives.getShape(ids.globalShape)!.members.has(name)
      ) {
        continue; // Natives can't be redeclared
      }
      const shape = this.shape(table, shapeId, shapeKindFor(shapeId));
      if (shape.readonly) continue;
      const symbol = deriveSymbol(shapeId, name, group);
      if ('alias' in symbol) {
        shape.members.set(name, symbol.alias);
        continue;
      }
      table.symbols.set(symbol.id, symbol);
      shape.members.set(name, symbol.id);
      // Named types for global declarations
      if (shapeId === ids.globalShape) this.addNamedTypes(table, symbol);
    }
    return table;
  }

  /**
   * Variables assigned in a shape that already exist in one of its
   * ancestors belong to that ancestor (so a child object assigning to a
   * parent's variable doesn't make a new one). Functions are the exception:
   * assigning a function makes an override.
   *
   * Returns the contribution groups to build, ancestors first.
   */
  protected resolveInheritance(
    table: SymbolTable,
    groups: Map<string, MemberContribution[]>,
  ): MemberContribution[][] {
    const depth = new Map<ShapeId, number>();
    const depthOf = (shape: ShapeId) => {
      let d = depth.get(shape);
      if (d === undefined)
        depth.set(shape, (d = table.ancestors(shape).length));
      return d;
    };
    const sorted = [...groups.values()].sort(
      (a, b) => depthOf(a[0].shape) - depthOf(b[0].shape),
    );
    const final = new Map<string, MemberContribution[]>();
    const key = (shape: ShapeId, name: string) => `${shape}\u0000${name}`;
    groups: for (const group of sorted) {
      const { shape, name } = group[0];
      const inheritable =
        shape !== ids.globalShape &&
        !shape.startsWith('local:') &&
        !shape.startsWith('enum:') &&
        !group.some((c) => c.fn || c.alias);
      if (inheritable) {
        for (const ancestor of table.ancestors(shape)) {
          const existing = final.get(key(ancestor, name));
          if (existing) {
            existing.push(
              ...group.map((c) => ({
                ...c,
                shape: ancestor,
                priority: Math.max(c.priority, 2),
              })),
            );
            continue groups;
          }
          if (this.natives.memberOf(ancestor, name)) continue groups;
        }
      }
      const k = key(shape, name);
      const existing = final.get(k);
      if (existing) existing.push(...group);
      else final.set(k, [...group]);
    }
    return [...final.values()];
  }

  protected shape(
    table: SymbolTable,
    id: ShapeId,
    kind: ShapeEntry['kind'],
  ): ShapeEntry {
    let shape = table.shapes.get(id);
    if (!shape) {
      const base = this.natives.getShape(id);
      shape = {
        id,
        kind: base?.kind ?? kind,
        name: base?.name,
        parents: base?.parents ? [...base.parents] : [],
        members: new Map(),
        readonly: base?.readonly,
      };
      table.shapes.set(id, shape);
    }
    return shape;
  }

  protected addNamedTypes(table: SymbolTable, symbol: SymbolEntry) {
    switch (symbol.kind) {
      case 'constructor':
        table.types.set(`Struct.${symbol.name}`, {
          kind: 'Struct',
          name: symbol.name,
        });
        table.types.set(`Function.${symbol.name}`, {
          kind: 'Function',
          name: symbol.name,
        });
        break;
      case 'function':
        table.types.set(`Function.${symbol.name}`, {
          kind: 'Function',
          name: symbol.name,
        });
        break;
      case 'enum':
        table.types.set(`Enum.${symbol.name}`, {
          kind: 'Enum',
          name: symbol.name,
        });
        break;
    }
  }

  protected addAssets(table: SymbolTable) {
    const global = table.shapes.get(ids.globalShape)!;
    const createEvents = new Map<string, FileState>();
    for (const state of this.files.values()) {
      const f = state.parsed.file;
      if (f.kind === 'objectEvent' && f.event === 'Create_0')
        createEvents.set(f.asset, state);
    }
    for (const asset of this.project.assets) {
      if (asset.kind === 'scripts' || asset.kind === 'extensions') continue;
      const typeKind = assetTypeKinds[asset.kind] ?? 'Any';
      const symbol: SymbolEntry = {
        id: ids.global(asset.name),
        name: asset.name,
        owner: ids.globalShape,
        kind: 'asset',
        assetKind: asset.kind,
        type: [{ kind: typeKind, name: asset.name }],
        global: true,
        writable: false,
      };
      if (asset.kind === 'objects') {
        const shapeId = ids.objectShape(asset.name);
        // Without `event_inherited()` in its Create event, an object
        // doesn't get its parent's variables
        const create = createEvents.get(asset.name);
        const inherits =
          asset.parent &&
          (!create ||
            (create.analysis?.callsInherited ??
              create.declarations.callsInherited));
        table.shapes.set(shapeId, {
          id: shapeId,
          kind: 'object',
          name: asset.name,
          symbol: symbol.id,
          parents: [
            inherits ? ids.objectShape(asset.parent!) : ids.instanceBase,
          ],
          members: new Map(),
        });
        symbol.shape = shapeId;
        table.types.set(`Id.Instance.${asset.name}`, {
          kind: 'Id.Instance',
          name: asset.name,
        });
        table.types.set(`Asset.GMObject.${asset.name}`, {
          kind: 'Asset.GMObject',
          name: asset.name,
        });
      } else if (typeKind !== 'Any') {
        table.types.set(`${typeKind}.${asset.name}`, {
          kind: typeKind,
          name: asset.name,
        });
      }
      table.symbols.set(symbol.id, symbol);
      global.members.set(asset.name, symbol.id);
    }
    for (const name of this.project.audioGroups ?? []) {
      const id = ids.global(name);
      table.symbols.set(id, {
        id,
        name,
        owner: ids.globalShape,
        kind: 'asset',
        assetKind: 'audiogroups',
        type: [{ kind: 'Asset.GMAudioGroup', name }],
        global: true,
        writable: false,
      });
      global.members.set(name, id);
    }
    for (const extension of this.project.extensions ?? []) {
      this.addExtension(table, extension);
    }
  }

  protected addExtension(table: SymbolTable, extension: ExtensionInfo) {
    const global = table.shapes.get(ids.globalShape)!;
    const typeName = (idx: number) => (idx === 1 ? 'String' : 'Real');
    for (const constant of extension.constants) {
      if (global.members.has(constant.name)) continue;
      const id = ids.global(constant.name);
      const kind = constant.value.startsWith('"')
        ? 'String'
        : /^-?[\d_.]+$/.test(constant.value)
          ? 'Real'
          : 'Any';
      table.symbols.set(id, {
        id,
        name: constant.name,
        owner: ids.globalShape,
        kind: 'macro',
        type: [{ kind }],
        global: true,
        writable: false,
        native: 'Extension',
      });
      global.members.set(constant.name, id);
    }
    for (const func of extension.functions) {
      if (global.members.has(func.name)) continue;
      const fnId = ids.fn(func.name);
      const local = ids.local(fnId);
      const params = func.args.map((arg, idx) => {
        const param: SymbolEntry = {
          id: ids.member(local, `argument${idx}`),
          name: `argument${idx}`,
          owner: local,
          kind: 'parameter',
          type: [{ kind: typeName(arg) }],
          parameter: true,
          local: true,
          idx,
          writable: true,
          native: 'Extension',
        };
        table.symbols.set(param.id, param);
        return param.id;
      });
      const fn: FunctionEntry = {
        id: fnId,
        name: func.name,
        symbol: ids.global(func.name),
        params,
        returns: [{ kind: typeName(func.returnType) }],
        isConstructor: false,
        description: func.help,
      };
      table.functions.set(fnId, fn);
      const id = ids.global(func.name);
      table.symbols.set(id, {
        id,
        name: func.name,
        owner: ids.globalShape,
        kind: 'function',
        type: [{ kind: 'Function', name: func.name }],
        fn: fnId,
        description: func.help,
        global: true,
        writable: false,
        native: 'Extension',
      });
      global.members.set(func.name, id);
    }
  }

  //#endregion

  protected _memberNames: Set<string> | undefined;

  /**
   * Names declared as members of any object or struct, or assigned on an
   * instance of unknown type (e.g. by a script function, on its caller)
   */
  get declaredMemberNames(): Set<string> {
    if (!this._memberNames) {
      const names = new Set<string>();
      for (const shape of this._table.shapes.values()) {
        if (shape.kind !== 'object' && shape.kind !== 'struct') continue;
        for (const name of shape.members.keys()) names.add(name);
      }
      const prefix = `${ids.instanceBase}/`;
      for (const state of this.files.values()) {
        for (const ref of state.analysis?.refs ?? []) {
          if (ref.write && ref.implicit && ref.symbol.startsWith(prefix)) {
            names.add(ref.symbol.slice(prefix.length));
          }
        }
      }
      this._memberNames = names;
    }
    return this._memberNames;
  }

  //#region References

  protected _refIndex:
    Map<string, { file: string; start: number; end: number }[]> | undefined;

  /** Every reference to every symbol, by symbol id */
  get refIndex() {
    if (!this._refIndex) {
      const index = new Map<
        string,
        { file: string; start: number; end: number }[]
      >();
      for (const [file, state] of this.files) {
        for (const ref of state.analysis?.refs ?? []) {
          let list = index.get(ref.symbol);
          if (!list) index.set(ref.symbol, (list = []));
          list.push({ file, start: ref.start, end: ref.end });
        }
      }
      this._refIndex = index;
    }
    return this._refIndex;
  }

  //#endregion
}

function sameFile(a: SourceFile, b: SourceFile): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.asset === b.asset &&
    a.event === b.event &&
    a.object === b.object
  );
}

function shapeKindFor(id: ShapeId): ShapeEntry['kind'] {
  if (id === ids.globalShape) return 'global';
  if (id.startsWith('obj:')) return 'object';
  if (id.startsWith('enum:')) return 'enum';
  if (id.startsWith('local:')) return 'local';
  return 'struct';
}

/** Contributions from the declarations pass, for files not yet checked */
function seedContributions(
  fileId: string,
  state: FileState,
): MemberContribution[] {
  const result: MemberContribution[] = [];
  const kinds = new Map<string, SymbolKind>([
    ['function', 'function'],
    ['constructor', 'constructor'],
    ['macro', 'macro'],
    ['enum', 'enum'],
    ['globalvar', 'variable'],
    ['globalMember', 'variable'],
    ['docGlobal', 'variable'],
  ]);
  for (const g of state.declarations.globals) {
    const constant = ['function', 'constructor', 'macro', 'enum'].includes(
      g.kind,
    );
    result.push({
      shape: ids.globalShape,
      name: g.name,
      file: fileId,
      start: g.start,
      end: g.end,
      priority: g.kind === 'globalMember' ? (g.assigned ? 1 : 3) : 0,
      kind: kinds.get(g.kind)!,
      writable: constant ? false : undefined,
      mixin: g.mixin,
      inferredType: g.type,
      fn:
        g.kind === 'function' || g.kind === 'constructor'
          ? ids.fn(g.name)
          : undefined,
      shapeRef:
        g.kind === 'enum'
          ? ids.enumShape(g.name)
          : g.kind === 'constructor'
            ? ids.structShape(g.name)
            : undefined,
      declaredType:
        g.kind === 'enum'
          ? [{ kind: 'Enum', name: g.name }]
          : g.kind === 'function' || g.kind === 'constructor'
            ? [{ kind: 'Function', name: g.name }]
            : undefined,
    });
    if (g.kind === 'enum') {
      for (const [idx, member] of (g.members ?? []).entries()) {
        result.push({
          shape: ids.enumShape(g.name),
          name: member.name,
          file: fileId,
          start: member.start,
          end: member.end,
          priority: 0,
          kind: 'enumMember',
          declaredType: [
            { kind: 'EnumMember', name: `${g.name}.${member.name}` },
          ],
          idx,
          writable: false,
        });
      }
    }
  }
  const file = state.parsed.file;
  for (const m of state.declarations.members) {
    const shape =
      m.owner === 'self'
        ? ids.objectShape(file.asset)
        : ids.structShape(m.owner.constructor);
    result.push({
      shape,
      name: m.name,
      file: fileId,
      start: m.start,
      end: m.end,
      priority: m.definitive ? 0 : 1,
      kind: 'variable',
      instance: true,
      static: m.static,
    });
  }
  return result;
}

/** Work out a member's symbol from everything that contributes to it */
function deriveSymbol(
  shape: ShapeId,
  name: string,
  group: MemberContribution[],
): SymbolEntry | { alias: string } {
  const sorted = [...group].sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
      a.start - b.start,
  );
  const def = sorted[0];
  if (def.alias) return { alias: def.alias };
  const declared = sorted.find((c) => c.declaredType?.length)?.declaredType;
  // Without a declared type, a variable's type is everything assigned to it
  const inferred = union(...sorted.map((c) => c.inferredType));
  const withFn = def.fn ? def : sorted.find((c) => c.fn);
  let kind = def.kind;
  if (kind === 'variable' && withFn?.kind && withFn.kind !== 'variable')
    kind = withFn.kind;
  const any = (key: keyof MemberContribution) =>
    sorted.some((c) => c[key]) || undefined;
  return {
    id: ids.member(shape, name),
    name,
    owner: shape,
    kind,
    def: { file: def.file, start: def.start, end: def.end },
    type: declared ?? inferred,
    description: sorted.find((c) => c.description)?.description,
    fn: withFn?.fn,
    shape: sorted.find((c) => c.shapeRef)?.shapeRef,
    idx: def.idx,
    global: shape === ids.globalShape || undefined,
    instance: shape !== ids.globalShape ? (any('instance') ?? true) : undefined,
    static: any('static') as boolean | undefined,
    deprecated: any('deprecated') as boolean | undefined,
    mixin: any('mixin') as boolean | undefined,
    writable: def.writable ?? true,
  };
}

//#region Diffing

function symbolFingerprint(s: SymbolEntry | undefined): string {
  if (!s) return '';
  return [
    s.kind,
    s.type.map(typeKey).join('|'),
    s.fn,
    s.shape,
    s.owner,
    s.static,
    s.instance,
    s.local,
    s.parameter,
    s.optional,
    s.writable,
    s.global,
    s.mixin,
    s.idx,
  ].join(';');
}

function typeKey(t: Type): string {
  return `${formatType(t)}#${t.entity ?? ''}${t.items ? `<${t.items.map(typeKey).join('|')}>` : ''}`;
}

/** Everything about a function's signature except its return type */
function functionFingerprint(f: FunctionEntry | undefined): string {
  if (!f) return '';
  return [
    f.params.join(','),
    f.self ? typeKey(f.self) : '',
    f.constructs,
    f.isConstructor,
    f.mixin,
    f.mixinShape,
    f.variadic,
    f.templates?.join(','),
  ].join(';');
}

function diffTables(before: SymbolTable, after: SymbolTable): ChangeSet {
  const changes: ChangeSet = {
    members: new Map(),
    symbols: new Set(),
    functions: new Set(),
  };
  const mark = (shape: ShapeId, name: string) => {
    let names = changes.members.get(shape);
    if (!names) changes.members.set(shape, (names = new Set()));
    names.add(name);
  };
  // File-private locals can't be depended on by other files (and the file
  // that owns them is being re-checked anyway), so they're skipped.
  const isPrivate = (id: string) => id.startsWith('local:');
  for (const id of new Set([...before.shapes.keys(), ...after.shapes.keys()])) {
    if (isPrivate(id)) continue;
    const a = before.shapes.get(id);
    const b = after.shapes.get(id);
    if (a === b) continue;
    if ((a?.parents ?? []).join(',') !== (b?.parents ?? []).join(','))
      mark(id, '*');
    const names = new Set([
      ...(a?.members.keys() ?? []),
      ...(b?.members.keys() ?? []),
    ]);
    for (const name of names) {
      if (a?.members.get(name) !== b?.members.get(name)) mark(id, name);
    }
  }
  for (const id of new Set([
    ...before.symbols.keys(),
    ...after.symbols.keys(),
  ])) {
    if (isPrivate(id)) continue;
    const [a, b] = [before.symbols.get(id), after.symbols.get(id)];
    if (a !== b && symbolFingerprint(a) !== symbolFingerprint(b))
      changes.symbols.add(id);
  }
  for (const id of new Set([
    ...before.functions.keys(),
    ...after.functions.keys(),
  ])) {
    const [a, b] = [before.functions.get(id), after.functions.get(id)];
    if (functionFingerprint(a) !== functionFingerprint(b))
      changes.functions.add(id);
    // Return types are tracked separately, since most calls ignore them
    if (
      (a?.returns ?? []).map(typeKey).join('|') !==
      (b?.returns ?? []).map(typeKey).join('|')
    ) {
      changes.symbols.add(`returns:${id}`);
    }
  }
  return changes;
}

function dependsOn(deps: FileAnalysis['deps'], changes: ChangeSet): boolean {
  // Iterate the file's dependencies (usually far fewer than the changes)
  for (const [shape, looked] of deps.members) {
    const names = changes.members.get(shape);
    if (!names) continue;
    // `*` in `names`: the shape's parents changed, affecting every lookup.
    // `*` in `looked`: the file listed all members, so any change matters.
    if (names.has('*') || looked.has('*')) return true;
    for (const name of looked) if (names.has(name)) return true;
  }
  for (const id of deps.symbols) if (changes.symbols.has(id)) return true;
  for (const id of deps.functions) if (changes.functions.has(id)) return true;
  return false;
}

//#endregion
