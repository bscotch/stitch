/**
 * The project symbol table, maintained incrementally from what each file
 * provides (its private entities and its member contributions).
 */
import type { MemberContribution, OwnedEntities } from './analysis.types.ts';
import type { ExtensionInfo, ProjectInfo } from './analyzer.ts';
import {
  ids,
  SymbolTable,
  type FunctionEntry,
  type ShapeEntry,
  type ShapeId,
  type SymbolEntry,
} from './symbols.ts';
import { formatType, union, type Type } from './types.ts';

/** What a file contributes to the project table */
export interface FileProvides {
  owned: OwnedEntities;
  members: MemberContribution[];
  /** For Create events: the object and whether it calls `event_inherited()` */
  createEventOf?: string;
  callsInherited?: boolean;
}

/** Keys of everything that changed in the table */
export interface ChangeSet {
  /** Shape → changed member names (`*` if the shape's parents changed) */
  members: Map<ShapeId, Set<string>>;
  /** Symbols whose fingerprint changed (and `returns:<fn>` for return types) */
  symbols: Set<string>;
  /** Functions whose signature changed */
  functions: Set<string>;
}

export function emptyChanges(): ChangeSet {
  return { members: new Map(), symbols: new Set(), functions: new Set() };
}

export function mergeChanges(into: ChangeSet, from: ChangeSet): ChangeSet {
  for (const [shape, names] of from.members) {
    let set = into.members.get(shape);
    if (!set) into.members.set(shape, (set = new Set()));
    for (const name of names) set.add(name);
  }
  for (const id of from.symbols) into.symbols.add(id);
  for (const id of from.functions) into.functions.add(id);
  return into;
}

export function isEmpty(changes: ChangeSet): boolean {
  return (
    !changes.members.size && !changes.symbols.size && !changes.functions.size
  );
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

type Owned = 'shapes' | 'functions' | 'symbols';

export class ProjectTable {
  /** The live table. Replaced (not mutated) on full rebuilds. */
  table: SymbolTable;
  protected readonly natives: SymbolTable;
  protected project: ProjectInfo;

  /** What each file provides, in file-id order */
  protected readonly provided = new Map<string, FileProvides>();
  /** Owned entity id → providing file → entity */
  protected readonly owners: Record<Owned, Map<string, Map<string, unknown>>> =
    {
      shapes: new Map(),
      functions: new Map(),
      symbols: new Map(),
    };
  /** Contribution groups: `shape\0name` → file → contributions */
  protected readonly groups = new Map<
    string,
    Map<string, MemberContribution[]>
  >();
  protected readonly keysByName = new Map<string, Set<string>>();
  /** What derivation produced: name → shape → member id */
  protected readonly derived = new Map<string, Map<ShapeId, string>>();
  /** Shape → derived member names */
  protected readonly derivedByShape = new Map<ShapeId, Set<string>>();
  /** Named types added for global declarations, by name */
  protected readonly namedTypes = new Map<string, string[]>();
  /**
   * Each shape's ancestors. Inheritance only changes with a full rebuild,
   * which clears this.
   */
  protected readonly ancestorCache = new Map<ShapeId, ShapeId[]>();

  /** Shape → shapes that list it as a parent. Cleared by rebuilds. */
  protected childrenIndex: Map<ShapeId, Set<ShapeId>> | undefined;

  /**
   * Shapes whose member derivation can affect each other: the shapes, their
   * ancestors and their descendants.
   */
  protected related(shapes: Iterable<ShapeId>): Set<ShapeId> {
    if (!this.childrenIndex) {
      this.childrenIndex = new Map();
      for (const shape of this.table.shapes.values()) {
        for (const parent of shape.parents) {
          let children = this.childrenIndex.get(parent);
          if (!children) this.childrenIndex.set(parent, (children = new Set()));
          children.add(shape.id);
        }
      }
    }
    const result = new Set<ShapeId>();
    for (const shape of shapes) {
      result.add(shape);
      for (const ancestor of this.ancestorsOf(shape)) result.add(ancestor);
      const queue = [shape];
      while (queue.length) {
        for (const child of this.childrenIndex.get(queue.pop()!) ?? []) {
          if (!result.has(child)) {
            result.add(child);
            queue.push(child);
          }
        }
      }
    }
    return result;
  }

  protected ancestorsOf(shape: ShapeId): ShapeId[] {
    let ancestors = this.ancestorCache.get(shape);
    if (!ancestors) {
      ancestors = this.table.ancestors(shape);
      this.ancestorCache.set(shape, ancestors);
    }
    return ancestors;
  }

  constructor(natives: SymbolTable, project: ProjectInfo = { assets: [] }) {
    this.natives = natives;
    this.project = project;
    this.table = this.emptyTable();
  }

  setProject(project: ProjectInfo): ChangeSet {
    this.project = project;
    return this.rebuild();
  }

  /**
   * Replace what many files provide. Large batches (like loading a project)
   * rebuild the table once instead of updating it file by file.
   */
  setFiles(
    updates: Map<string, FileProvides | undefined>,
    rebuildThreshold: number,
  ): ChangeSet {
    if (updates.size > rebuildThreshold) {
      for (const [fileId, provides] of updates) {
        if (provides) this.provided.set(fileId, provides);
        else this.provided.delete(fileId);
      }
      return this.rebuild();
    }
    const changes = emptyChanges();
    for (const [fileId, provides] of updates) {
      mergeChanges(changes, this.setFile(fileId, provides));
    }
    return changes;
  }

  /** Replace what a file provides (or remove it, with `undefined`) */
  setFile(fileId: string, provides: FileProvides | undefined): ChangeSet {
    const old = this.provided.get(fileId);
    if (provides) this.provided.set(fileId, provides);
    else this.provided.delete(fileId);
    if (this.isStructural(old, provides)) return this.rebuild();

    const changes = emptyChanges();
    // The member names whose contributions changed, and the shapes involved
    const changedShapes = new Map<string, Set<ShapeId>>();
    for (const c of [...(old?.members ?? []), ...(provides?.members ?? [])]) {
      let shapes = changedShapes.get(c.name);
      if (!shapes) changedShapes.set(c.name, (shapes = new Set()));
      shapes.add(c.shape);
    }
    const affected = new Map(
      [...changedShapes].map(([name, shapes]) => [name, this.related(shapes)]),
    );
    const before = this.snapshot(old, provides, affected);
    // Owned entities
    for (const kind of ['shapes', 'functions', 'symbols'] as const) {
      const ids = new Set([
        ...(old?.owned[kind] ?? []).map((e) => e.id),
        ...(provides?.owned[kind] ?? []).map((e) => e.id),
      ]);
      const next = new Map((provides?.owned[kind] ?? []).map((e) => [e.id, e]));
      for (const id of ids) {
        let byFile = this.owners[kind].get(id);
        if (!byFile) this.owners[kind].set(id, (byFile = new Map()));
        if (next.has(id)) byFile.set(fileId, next.get(id));
        else byFile.delete(fileId);
        if (!byFile.size) this.owners[kind].delete(id);
        this.applyOwned(kind, id);
      }
    }
    // Member contributions
    const names = new Set<string>();
    const oldKeys = new Set((old?.members ?? []).map(groupKey));
    const newByKey = new Map<string, MemberContribution[]>();
    for (const c of provides?.members ?? []) {
      const key = groupKey(c);
      if (!newByKey.has(key)) newByKey.set(key, []);
      newByKey.get(key)!.push(c);
    }
    for (const key of new Set([...oldKeys, ...newByKey.keys()])) {
      let byFile = this.groups.get(key);
      if (!byFile) this.groups.set(key, (byFile = new Map()));
      const contributions = newByKey.get(key);
      if (contributions) byFile.set(fileId, contributions);
      else byFile.delete(fileId);
      const name = key.slice(key.indexOf('\u0000') + 1);
      if (!byFile.size) {
        this.groups.delete(key);
        this.keysByName.get(name)?.delete(key);
      } else {
        let keys = this.keysByName.get(name);
        if (!keys) this.keysByName.set(name, (keys = new Set()));
        keys.add(key);
      }
      names.add(name);
    }
    for (const name of names) this.derive(name, affected.get(name));
    this.diffSnapshot(before, changes);
    return changes;
  }

  //#region Building

  protected emptyTable(): SymbolTable {
    const table = new SymbolTable(this.natives);
    table.shapes.set(ids.globalShape, {
      id: ids.globalShape,
      kind: 'global',
      name: 'global',
      parents: [],
      members: new Map(),
    });
    return table;
  }

  /** Rebuild everything, returning what changed */
  protected rebuild(): ChangeSet {
    const before = this.table;
    this.table = this.emptyTable();
    for (const map of Object.values(this.owners)) map.clear();
    this.groups.clear();
    this.keysByName.clear();
    this.derived.clear();
    this.derivedByShape.clear();
    this.namedTypes.clear();
    this.ancestorCache.clear();
    this.childrenIndex = undefined;
    this.addAssets();
    for (const [fileId, provides] of this.provided) {
      for (const kind of ['shapes', 'functions', 'symbols'] as const) {
        for (const entity of provides.owned[kind]) {
          let byFile = this.owners[kind].get(entity.id);
          if (!byFile) this.owners[kind].set(entity.id, (byFile = new Map()));
          byFile.set(fileId, entity);
        }
      }
      for (const c of provides.members) this.addContribution(fileId, c);
    }
    for (const kind of ['shapes', 'functions', 'symbols'] as const) {
      for (const id of this.owners[kind].keys()) this.applyOwned(kind, id);
    }
    // Ancestors first, so inheritance resolves in one go
    for (const name of this.keysByName.keys()) this.derive(name);
    return diffTables(before, this.table);
  }

  /**
   * Changes to inheritance (constructor parents, or whether a Create event
   * calls `event_inherited()`) affect many names, so they rebuild everything.
   */
  protected isStructural(
    old: FileProvides | undefined,
    next: FileProvides | undefined,
  ): boolean {
    const parents = (p: FileProvides | undefined) =>
      new Map((p?.owned.shapes ?? []).map((s) => [s.id, s.parents.join(',')]));
    const [a, b] = [parents(old), parents(next)];
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      if ((a.get(id) ?? '') !== (b.get(id) ?? '')) return true;
    }
    const inherits = (p: FileProvides | undefined) =>
      p?.createEventOf ? `${p.createEventOf}:${p.callsInherited}` : '';
    return inherits(old) !== inherits(next);
  }

  /** Put the preferred provider's version of an owned entity in the table */
  protected applyOwned(kind: Owned, id: string) {
    const byFile = this.owners[kind].get(id);
    // Deterministic choice among duplicates: the first file, by id
    const chosen = byFile?.size
      ? byFile.get([...byFile.keys()].sort()[0])
      : undefined;
    if (kind === 'functions') {
      if (chosen) this.table.functions.set(id, chosen as FunctionEntry);
      else this.table.functions.delete(id);
    } else if (kind === 'symbols') {
      if (chosen) this.table.symbols.set(id, chosen as SymbolEntry);
      else this.table.symbols.delete(id);
    } else {
      const derivedNames = this.derivedByShape.get(id);
      const current = this.table.shapes.get(id);
      if (!chosen && !derivedNames?.size) {
        if (current && !this.isBaseShape(id)) this.table.shapes.delete(id);
        return;
      }
      const shape = chosen as ShapeEntry | undefined;
      const next: ShapeEntry = shape
        ? {
            ...shape,
            members: new Map(shape.members),
            parents: [...shape.parents],
          }
        : {
            id,
            kind: shapeKindFor(id),
            parents: current?.parents ?? [],
            members: new Map(),
          };
      // Keep members derived from contributions
      for (const name of derivedNames ?? []) {
        const member = current?.members.get(name);
        if (member) next.members.set(name, member);
      }
      this.table.shapes.set(id, next);
    }
  }

  protected isBaseShape(id: ShapeId): boolean {
    return id === ids.globalShape || id.startsWith('obj:');
  }

  /** A shape to add contributed members to, created if needed */
  protected shapeFor(id: ShapeId): ShapeEntry {
    let shape = this.table.shapes.get(id);
    if (!shape) {
      const base = this.natives.getShape(id);
      shape = {
        id,
        kind: base?.kind ?? shapeKindFor(id),
        name: base?.name,
        parents: base?.parents ? [...base.parents] : [],
        members: new Map(),
        readonly: base?.readonly,
      };
      this.table.shapes.set(id, shape);
    }
    return shape;
  }

  /**
   * Re-derive the members with a given name from their contributions:
   * all of them, or just those in the given (related) shapes.
   */
  protected derive(name: string, only?: Set<ShapeId>) {
    const table = this.table;
    const previous = this.derived.get(name) ?? new Map<ShapeId, string>();
    // Remove what was derived before
    for (const [shapeId, memberId] of previous) {
      if (only && !only.has(shapeId)) continue;
      const shape = table.shapes.get(shapeId);
      if (shape?.members.get(name) === memberId) shape.members.delete(name);
      if (
        memberId === ids.member(shapeId, name) &&
        !this.owners.symbols.has(memberId)
      ) {
        table.symbols.delete(memberId);
      }
      this.derivedByShape.get(shapeId)?.delete(name);
      // Shapes that only existed for contributions
      if (
        shape &&
        !shape.members.size &&
        !this.owners.shapes.has(shapeId) &&
        !this.isBaseShape(shapeId) &&
        !this.natives.getShape(shapeId)
      ) {
        table.shapes.delete(shapeId);
      }
    }
    if (!only || only.has(ids.globalShape)) {
      for (const typeName of this.namedTypes.get(name) ?? [])
        table.types.delete(typeName);
      this.namedTypes.delete(name);
    }
    const produced = new Map<ShapeId, string>();
    if (only) {
      for (const [shapeId, memberId] of previous) {
        if (!only.has(shapeId)) produced.set(shapeId, memberId);
      }
    }
    this.derived.set(name, produced);

    const groups: MemberContribution[][] = [];
    for (const key of this.keysByName.get(name) ?? []) {
      if (only && !only.has(key.slice(0, key.indexOf('\u0000')))) continue;
      const byFile = this.groups.get(key);
      if (byFile?.size) groups.push([...byFile.values()].flat());
    }
    for (const group of this.resolveInheritance(groups)) {
      const shapeId = group[0].shape;
      if (
        shapeId === ids.globalShape &&
        this.natives.getShape(ids.globalShape)!.members.has(name)
      ) {
        continue; // Natives can't be redeclared
      }
      if (shapeId === ids.globalShape && this.isAsset(name)) continue;
      const shape = this.shapeFor(shapeId);
      if (shape.readonly) continue;
      const symbol = deriveSymbol(shapeId, name, group);
      const memberId = 'alias' in symbol ? symbol.alias : symbol.id;
      if (!('alias' in symbol)) table.symbols.set(symbol.id, symbol);
      shape.members.set(name, memberId);
      produced.set(shapeId, memberId);
      let names = this.derivedByShape.get(shapeId);
      if (!names) this.derivedByShape.set(shapeId, (names = new Set()));
      names.add(name);
      if (shapeId === ids.globalShape && !('alias' in symbol))
        this.addNamedTypes(symbol);
    }
  }

  protected isAsset(name: string): boolean {
    return this.table.getSymbol(ids.global(name))?.kind === 'asset';
  }

  /**
   * Variables assigned in a shape that already exist in one of its
   * ancestors belong to that ancestor (so a child object assigning to a
   * parent's variable doesn't make a new one). Functions are the exception:
   * assigning a function makes an override.
   */
  protected resolveInheritance(
    groups: MemberContribution[][],
  ): MemberContribution[][] {
    const depthOf = (shape: ShapeId) => this.ancestorsOf(shape).length;
    const sorted = [...groups].sort(
      (a, b) => depthOf(a[0].shape) - depthOf(b[0].shape),
    );
    const final = new Map<ShapeId, MemberContribution[]>();
    groups: for (const group of sorted) {
      const { shape, name } = group[0];
      const inheritable =
        shape !== ids.globalShape &&
        !shape.startsWith('local:') &&
        !shape.startsWith('enum:') &&
        !group.some((c) => c.fn || c.alias);
      if (inheritable) {
        for (const ancestor of this.ancestorsOf(shape)) {
          const existing = final.get(ancestor);
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
      const existing = final.get(shape);
      if (existing) existing.push(...group);
      else final.set(shape, [...group]);
    }
    return [...final.values()];
  }

  protected addNamedTypes(symbol: SymbolEntry) {
    const types: [string, Type][] = [];
    if (symbol.kind === 'constructor') {
      types.push([
        `Struct.${symbol.name}`,
        { kind: 'Struct', name: symbol.name },
      ]);
    }
    if (symbol.kind === 'constructor' || symbol.kind === 'function') {
      types.push([
        `Function.${symbol.name}`,
        { kind: 'Function', name: symbol.name },
      ]);
    }
    if (symbol.kind === 'enum') {
      types.push([`Enum.${symbol.name}`, { kind: 'Enum', name: symbol.name }]);
    }
    for (const [name, type] of types) this.table.types.set(name, type);
    if (types.length)
      this.namedTypes.set(
        symbol.name,
        types.map(([n]) => n),
      );
  }

  protected addAssets() {
    const table = this.table;
    const global = table.shapes.get(ids.globalShape)!;
    const inheritsByObject = new Map<string, boolean>();
    for (const provides of this.provided.values()) {
      if (provides.createEventOf) {
        inheritsByObject.set(provides.createEventOf, !!provides.callsInherited);
      }
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
        const inherits =
          asset.parent && (inheritsByObject.get(asset.name) ?? true);
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
    // Object variables defined in the IDE: declared by the object itself,
    // before any of its code runs
    for (const asset of this.project.assets) {
      for (const variable of asset.variables ?? []) {
        this.addContribution(variable.file, {
          shape: ids.objectShape(asset.name),
          name: variable.name,
          file: variable.file,
          start: 0,
          end: 0,
          priority: -1,
          kind: 'variable',
          declaredType: this.objectVariableType(variable.varType),
          description: `Defined in the object editor${variable.value !== undefined ? ` (default: \`${variable.value}\`)` : ''}.`,
          instance: true,
        });
      }
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
    for (const extension of this.project.extensions ?? [])
      this.addExtension(extension);
  }

  protected objectVariableType(varType: number): Type[] {
    switch (varType) {
      case 0:
      case 1:
        return [{ kind: 'Real' }];
      case 2:
        return [{ kind: 'String' }];
      case 3:
        return [{ kind: 'Bool' }];
      case 5:
        return [{ kind: 'Asset' }];
      case 7:
        return [this.natives.getType('Constant.Color') ?? { kind: 'Real' }];
      default:
        return [{ kind: 'Any' }];
    }
  }

  protected addContribution(fileId: string, c: MemberContribution) {
    const key = groupKey(c);
    let byFile = this.groups.get(key);
    if (!byFile) this.groups.set(key, (byFile = new Map()));
    if (!byFile.has(fileId)) byFile.set(fileId, []);
    byFile.get(fileId)!.push(c);
    let keys = this.keysByName.get(c.name);
    if (!keys) this.keysByName.set(c.name, (keys = new Set()));
    keys.add(key);
  }

  protected addExtension(extension: ExtensionInfo) {
    const table = this.table;
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
      table.functions.set(fnId, {
        id: fnId,
        name: func.name,
        symbol: ids.global(func.name),
        params,
        returns: [{ kind: typeName(func.returnType) }],
        isConstructor: false,
        description: func.help,
      });
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

  //#region Change tracking

  /** Fingerprints of everything a file update could change */
  protected snapshot(
    old: FileProvides | undefined,
    next: FileProvides | undefined,
    affected: Map<string, Set<ShapeId>>,
  ) {
    const table = this.table;
    const symbolIds = new Set<string>();
    const functionIds = new Set<string>();
    const shapeIds = new Set<string>();
    const names = new Set<string>();
    for (const p of [old, next]) {
      for (const s of p?.owned.symbols ?? []) symbolIds.add(s.id);
      for (const f of p?.owned.functions ?? []) functionIds.add(f.id);
      for (const s of p?.owned.shapes ?? []) shapeIds.add(s.id);
      for (const c of p?.members ?? []) names.add(c.name);
    }
    // Everything currently derived for the affected names
    const members = new Map<string, string | undefined>();
    for (const name of names) {
      const shapes = affected.get(name);
      for (const [shape, id] of this.derived.get(name) ?? []) {
        if (shapes && !shapes.has(shape)) continue;
        members.set(`${shape}\u0000${name}`, id);
        symbolIds.add(id);
      }
    }
    for (const shapeId of shapeIds) {
      for (const [name, id] of table.shapes.get(shapeId)?.members ?? []) {
        members.set(`${shapeId}\u0000${name}`, id);
      }
    }
    const symbols = new Map(
      [...symbolIds].map((id) => [
        id,
        symbolFingerprint(table.symbols.get(id)),
      ]),
    );
    const functions = new Map(
      [...functionIds].map((id) => {
        const f = table.functions.get(id);
        return [id, [functionFingerprint(f), returnsKey(f)]] as const;
      }),
    );
    return { members, symbols, functions, names, shapeIds, affected };
  }

  protected diffSnapshot(
    before: ReturnType<ProjectTable['snapshot']>,
    changes: ChangeSet,
  ) {
    const table = this.table;
    const mark = (shape: ShapeId, name: string) => {
      let set = changes.members.get(shape);
      if (!set) changes.members.set(shape, (set = new Set()));
      set.add(name);
    };
    // Members: compare everything before with the same keys now, plus new keys
    const after = new Map<string, string | undefined>();
    for (const name of before.names) {
      const shapes = before.affected.get(name);
      for (const [shape, id] of this.derived.get(name) ?? []) {
        if (shapes && !shapes.has(shape)) continue;
        after.set(`${shape}\u0000${name}`, id);
      }
    }
    for (const shapeId of before.shapeIds) {
      for (const [name, id] of table.shapes.get(shapeId)?.members ?? [])
        after.set(`${shapeId}\u0000${name}`, id);
    }
    for (const key of new Set([...before.members.keys(), ...after.keys()])) {
      const current = after.has(key) ? after.get(key) : memberAt(table, key);
      if (before.members.get(key) !== current) {
        const [shape, name] = key.split('\u0000');
        mark(shape, name);
      }
    }
    const symbolIds = new Set([...before.symbols.keys(), ...after.values()]);
    for (const id of symbolIds) {
      if (!id || id.startsWith('local:')) continue;
      if (
        (before.symbols.get(id) ?? '') !==
        symbolFingerprint(table.symbols.get(id))
      )
        changes.symbols.add(id);
    }
    for (const [id, [signature, returns]] of before.functions) {
      const f = table.functions.get(id);
      if (signature !== functionFingerprint(f)) changes.functions.add(id);
      if (returns !== returnsKey(f)) changes.symbols.add(`returns:${id}`);
    }
  }

  //#endregion
}

function memberAt(table: SymbolTable, key: string): string | undefined {
  const [shape, name] = key.split('\u0000');
  return table.shapes.get(shape)?.members.get(name);
}

function groupKey(c: MemberContribution): string {
  return `${c.shape}\u0000${c.name}`;
}

function shapeKindFor(id: ShapeId): ShapeEntry['kind'] {
  if (id === ids.globalShape) return 'global';
  if (id.startsWith('obj:')) return 'object';
  if (id.startsWith('enum:')) return 'enum';
  if (id.startsWith('local:')) return 'local';
  return 'struct';
}

/** Work out a member's symbol from everything that contributes to it */
export function deriveSymbol(
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
  if (kind === 'variable' && withFn?.kind && withFn.kind !== 'variable') {
    kind = withFn.kind;
  }
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
    value: def.value,
    global: shape === ids.globalShape || undefined,
    instance: shape !== ids.globalShape ? (any('instance') ?? true) : undefined,
    static: any('static') as boolean | undefined,
    deprecated: any('deprecated') as boolean | undefined,
    mixin: any('mixin') as boolean | undefined,
    writable: def.writable ?? true,
  };
}

//#region Fingerprints and diffs

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

function returnsKey(f: FunctionEntry | undefined): string {
  return (f?.returns ?? []).map(typeKey).join('|');
}

/** Everything that differs between two tables */
export function diffTables(before: SymbolTable, after: SymbolTable): ChangeSet {
  const changes = emptyChanges();
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
    if (returnsKey(a) !== returnsKey(b)) changes.symbols.add(`returns:${id}`);
  }
  return changes;
}

//#endregion
