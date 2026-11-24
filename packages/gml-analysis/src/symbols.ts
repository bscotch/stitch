/**
 * The symbol table: plain-data entities that the analysis builds and
 * queries. Entities refer to each other by stable string ids, never by
 * object references, so they can be rebuilt independently.
 *
 * - A **symbol** is a named thing that code can refer to: a variable,
 *   function, macro, enum, enum member, parameter, asset, ...
 * - A **shape** holds named members: the global scope, a struct, an object's
 *   instance variables, an enum, a function's local scope. Shapes can
 *   inherit members from parent shapes.
 * - A **function** entity holds a signature: parameters, return type,
 *   `self` context, and (for constructors) the shape it constructs.
 */
import type { Type, TypeUnion } from './types.ts';

export type SymbolId = string;
export type ShapeId = string;
export type FunctionId = string;

/** A location in a source file, by offsets */
export interface Location {
  file: string;
  start: number;
  end: number;
}

export type SymbolKind =
  | 'variable'
  | 'function'
  | 'constructor'
  | 'macro'
  | 'enum'
  | 'enumMember'
  | 'parameter'
  | 'asset'
  | 'constant'
  | 'global';

export interface SymbolEntry {
  readonly id: SymbolId;
  readonly name: string;
  /** The shape this symbol is a member of */
  readonly owner: ShapeId;
  kind: SymbolKind;
  /** Where it is declared, if declared in code */
  def?: Location;
  /** For native symbols, the runtime module it comes from */
  native?: string;
  description?: string;
  type: TypeUnion;
  /** For functions: the function entity */
  fn?: FunctionId;
  /** For enums, structs, objects: the shape this symbol names */
  shape?: ShapeId;
  /** For parameters, their position */
  idx?: number;
  global?: boolean;
  local?: boolean;
  instance?: boolean;
  parameter?: boolean;
  static?: boolean;
  optional?: boolean;
  deprecated?: boolean;
  mixin?: boolean;
  writable: boolean;
  /** For assets, their kind (`objects`, `sprites`, ...) */
  assetKind?: string;
  /** For enum members, their numeric value if known */
  value?: number;
}

export type ShapeKind =
  'global' | 'struct' | 'object' | 'enum' | 'local' | 'instanceBase';

export interface ShapeEntry {
  readonly id: ShapeId;
  kind: ShapeKind;
  /** The name it is known by (constructor, object, enum, native struct) */
  name?: string;
  /** The symbol that names it, if any */
  symbol?: SymbolId;
  /** Shapes this one inherits members from, nearest first */
  parents: ShapeId[];
  members: Map<string, SymbolId>;
  /** Native shapes can't gain members */
  readonly?: boolean;
}

export interface FunctionEntry {
  readonly id: FunctionId;
  name?: string;
  /** The symbol this function is assigned to, if any */
  symbol?: SymbolId;
  /** Parameter symbols, in order */
  params: SymbolId[];
  returns: TypeUnion;
  /** The `self` the function runs in, if known */
  self?: Type;
  isConstructor: boolean;
  /** For constructors, the shape of the structs they create */
  constructs?: ShapeId;
  /** The function's local scope */
  local?: ShapeId;
  /** Template parameter names */
  templates?: string[];
  mixin?: boolean;
  /** For mixins, the shape holding the variables they add to their caller */
  mixinShape?: ShapeId;
  description?: string;
  deprecated?: boolean;
  /** The function accepts any number of extra arguments */
  variadic?: boolean;
}

/** Records what a lookup depended on, for incremental invalidation */
export interface DependencyRecorder {
  /** A member of a shape was looked up (whether or not it was found) */
  member(shape: ShapeId, name: string): void;
  /** A symbol's type was used */
  symbol(id: SymbolId): void;
}

/**
 * A read-only view of entities, possibly layered over another table (e.g.
 * project entities over native ones).
 */
export class SymbolTable {
  readonly symbols = new Map<SymbolId, SymbolEntry>();
  readonly shapes = new Map<ShapeId, ShapeEntry>();
  readonly functions = new Map<FunctionId, FunctionEntry>();
  /** Named types (`Struct.Foo`, `Enum.Bar`, ...) */
  readonly types = new Map<string, Type>();
  readonly base: SymbolTable | undefined;

  constructor(base?: SymbolTable) {
    this.base = base;
  }

  getSymbol(id: SymbolId | undefined): SymbolEntry | undefined {
    if (!id) return undefined;
    return this.symbols.get(id) ?? this.base?.getSymbol(id);
  }

  getShape(id: ShapeId | undefined): ShapeEntry | undefined {
    if (!id) return undefined;
    return this.shapes.get(id) ?? this.base?.getShape(id);
  }

  getFunction(id: FunctionId | undefined): FunctionEntry | undefined {
    if (!id) return undefined;
    return this.functions.get(id) ?? this.base?.getFunction(id);
  }

  getType(name: string): Type | undefined {
    return this.types.get(name) ?? this.base?.getType(name);
  }

  /**
   * Find a member of a shape, searching its parents. Records the lookup
   * on every shape it visits, so that adding the member to any of them
   * invalidates the result.
   */
  findMember(
    shapeId: ShapeId | undefined,
    name: string,
    deps?: DependencyRecorder,
    options?: { ownOnly?: boolean },
  ): SymbolEntry | undefined {
    const seen = new Set<ShapeId>();
    const queue: (ShapeId | undefined)[] = [shapeId];
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deps?.member(id, name);
      const shape = this.getShape(id);
      if (!shape) continue;
      const found = this.memberOf(shape, name);
      if (found) return this.getSymbol(found);
      if (!options?.ownOnly) queue.push(...shape.parents);
    }
    return undefined;
  }

  /** All members of a shape, including inherited ones (nearest wins) */
  listMembers(
    shapeId: ShapeId | undefined,
    deps?: DependencyRecorder,
  ): SymbolEntry[] {
    const found = new Map<string, SymbolEntry>();
    const seen = new Set<ShapeId>();
    const queue: (ShapeId | undefined)[] = [shapeId];
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deps?.member(id, '*');
      const shape = this.getShape(id);
      if (!shape) continue;
      for (const name of this.memberNames(shape)) {
        if (found.has(name)) continue;
        const symbol = this.getSymbol(this.memberOf(shape, name));
        if (symbol) found.set(name, symbol);
      }
      queue.push(...shape.parents);
    }
    return [...found.values()];
  }

  /** The chain of shapes a shape inherits from (excluding itself) */
  ancestors(shapeId: ShapeId): ShapeId[] {
    const result: ShapeId[] = [];
    const queue = [...(this.getShape(shapeId)?.parents || [])];
    while (queue.length) {
      const id = queue.shift()!;
      if (result.includes(id) || id === shapeId) continue;
      result.push(id);
      queue.push(...(this.getShape(id)?.parents || []));
    }
    return result;
  }

  /**
   * A shape's own member, checking every layer (layered tables can add
   * members to a base table's shape, e.g. the global scope).
   */
  memberOf(shape: ShapeEntry | ShapeId, name: string): SymbolId | undefined {
    const id = typeof shape === 'string' ? shape : shape.id;
    return (
      this.shapes.get(id)?.members.get(name) ?? this.base?.memberOf(id, name)
    );
  }

  /** A shape's own member names, across every layer */
  memberNames(shape: ShapeEntry | ShapeId): Set<string> {
    const id = typeof shape === 'string' ? shape : shape.id;
    const names = this.base ? this.base.memberNames(id) : new Set<string>();
    for (const name of this.shapes.get(id)?.members.keys() ?? [])
      names.add(name);
    return names;
  }
}

/** Ids of well-known entities */
export const ids = {
  globalShape: 'global',
  instanceBase: 'instance',
  global: (name: string) => `global/${name}`,
  member: (shape: ShapeId, name: string) => `${shape}/${name}`,
  objectShape: (name: string) => `obj:${name}`,
  structShape: (name: string) => `struct:${name}`,
  enumShape: (name: string) => `enum:${name}`,
  fn: (key: string) => `fn:${key}`,
  local: (key: string) => `local:${key}`,
};
