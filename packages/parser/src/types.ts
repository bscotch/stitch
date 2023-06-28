import { arrayUnwrapped, merge } from '@bscotch/utility';
import { Signifier } from './signifiers.js';
import { typeToHoverDetails, typeToHoverText } from './types.hover.js';
import type { PrimitiveName, WithableTypeName } from './types.primitives.js';
import { ok } from './util.js';

export type AnyType = Type<'Any'>;
export type ArrayType = Type<'Array'>;
export type BoolType = Type<'Bool'>;
export type UnionType = Type<'Union'>;
export type FunctionType = Type<'Function'>;
export type PointerType = Type<'Pointer'>;
export type RealType = Type<'Real'>;
export type StringType = Type<'String'>;
export type StructType = Type<'Struct'>;
export type UndefinedType = Type<'Undefined'>;
export type WithableType = Type<WithableTypeName>;

export interface TypeConfig<T extends PrimitiveName = PrimitiveName> {
  kind?: T | undefined;
  /**
   * Some types have names. It only counts as a name if it
   * cannot be parsed into types given the name alone.
   * E.g. `Array<String>` is not a name, but `Struct.MyStruct`
   * has the name `MyStruct`. */
  name?: string;
  /** "Container" types can list the types of the things they store. */
  contains?: UnionType;
  /** For constructor functions, the struct type they generate */
  constructs?: Type<'Struct'>;
  /** The self context for a function */
  context?: Type<'Struct'>;
  members?: Signifier[];
  params?: Signifier[];
  returns?: UnionType;
}

/**
 * Create config object with all keys but undefined values
 * to keep things monomorphic.
 */
function emptyConfig<T extends PrimitiveName>(
  kind?: T | undefined,
): TypeConfig<T> {
  return {
    kind,
    name: undefined,
    contains: undefined,
    constructs: undefined,
    context: undefined,
    members: undefined,
    params: undefined,
    returns: undefined,
  };
}

export class Type<T extends PrimitiveName = PrimitiveName> {
  readonly $tag = 'Type';
  /**
   * The properties collectively describing this type. Used to override
   * the parent type's properties. Missing properties are inherited from
   * the parent.
   */
  protected config: TypeConfig<T>;
  /**
   * If set, then this Type is treated as a subset of the parent.
   * It will only "match" another type if that type is in its
   * parent somewhere. Useful for struct/constructor inheritence, as well
   * as for e.g. representing a subset of Real constants in a type. */
  parent: Type<T> | undefined = undefined;
  /**
   * Types created from this one using `extend()`, and therefore listing
   * this one as their `parent`. Child types can only narrow parent types.
   */
  protected readonly children: Set<Type<T>> = new Set();
  /**
   * Signifiers that are considered to be of this type. If this type changes,
   * then all signifiers must be informed of the change.
   */
  protected readonly refs: Set<Signifier> = new Set();

  mutate(configPatch: TypeConfig<T>): this;
  mutate<K extends keyof TypeConfig<T>>(
    field: K,
    value: TypeConfig<T>[K],
  ): this;
  mutate(
    field: keyof TypeConfig<T> | TypeConfig<T>,
    value?: TypeConfig<T>[keyof TypeConfig<T>],
  ): this {
    if (typeof field === 'string') {
      // @ts-expect-error
      this.config[field] = value;
    } else {
      merge(this.config, field);
    }
    // TODO: Emit mutation event and inform descendents and referrers
    return this;
  }

  //#region Property getters
  get kind(): T {
    return this.config.kind || this.parent!.kind;
  }
  get name(): string | undefined {
    return this.config.name || this.parent?.name;
  }
  get contains(): UnionType | undefined {
    return this.config.contains || this.parent?.contains;
  }
  get constructs(): StructType | undefined {
    return this.config.constructs || this.parent?.constructs;
  }
  get context(): StructType | undefined {
    return this.config.context || this.parent?.context;
  }
  set context(value: StructType | StructType[]) {
    this.mutate({ context: arrayUnwrapped(value) });
  }
  get members(): readonly Signifier[] {
    return this.config.members || this.parent?.members || [];
  }
  get params(): readonly Signifier[] {
    return this.config.params || this.parent?.params || [];
  }
  get returns(): UnionType | undefined {
    return this.config.returns || this.parent?.returns;
  }
  //#endregion

  constructor(kind: T);
  constructor(config: TypeConfig<T>);
  constructor(fromParent: Type<T>);
  constructor(kind: T | TypeConfig<T> | Type<T>) {
    this.config =
      typeof kind === 'string'
        ? emptyConfig(kind)
        : kind instanceof Type
        ? (emptyConfig() as TypeConfig<T>)
        : merge(emptyConfig(), kind);
    if (kind instanceof Type) {
      this.parent = kind;
      this.parent.children.add(this);
    }
  }

  get code(): string {
    return typeToHoverText(this);
  }

  get details(): string {
    return typeToHoverDetails(this);
  }

  get isFunction(): boolean {
    return this.kind === 'Function';
  }

  get isConstructor(): boolean {
    return this.kind === 'Function' && this.constructs !== undefined;
  }

  addReturnType(type: Type | Type[]): this {
    ok(this.kind === 'Function', `Cannot add return type to ${this.kind}`);
    if (!this.returns) {
      this.mutate({ returns: new Type('Union') });
    }
    this.returns!.addContainedType(type);
  }

  listParameters(): Signifier[] {
    return this.params ? [...this.params] : [];
  }

  getParameter(name: string): Signifier | undefined;
  getParameter(idx: number): Signifier | undefined;
  getParameter(nameOrIdx: string | number): Signifier | undefined {
    if (!this.params) {
      return undefined;
    }
    if (typeof nameOrIdx === 'string') {
      return this.params.find((p) => p.name === nameOrIdx);
    }
    return this.params[nameOrIdx];
  }

  addParameter(
    idx: number,
    name: string,
    type: Type | Type[],
    optional = false,
  ) {
    ok(this.isFunction, `Cannot add param to ${this.kind} type`);
    const params = [...this.params];
    let param = params[idx];
    if (!param) {
      param = new Signifier(this as StructType, name, type);
      params[idx] = param;
      this.mutate({ params });
    }
    param.idx = idx;
    param.local = true;
    param.optional = optional || name === '...';
    param.parameter = true;
    param.addType(type);
    return param;
  }

  listMembers(excludeParents = false): Signifier[] {
    if (excludeParents || !this.parent) {
      return [...this.members];
    }
    return [...this.members, ...this.parent.listMembers()];
  }

  getMember(name: string): Signifier | undefined {
    return (
      this.members.find((m) => m.name === name) || this.parent?.getMember(name)
    );
  }

  /** For container types that have named members, like Structs and Enums */
  addMember(name: string, type: Type, writable = true): Signifier {
    let member = this.members.find((m) => m.name === name);
    if (!member) {
      member = new Signifier(this as StructType, name, type);
      member.writable = writable;
      this.mutate({ members: [...this.members, member] });
    }
    return member;
  }

  removeMember(name: string) {
    const idx = this.members?.findIndex((m) => m.name === name);
    if (idx === undefined || idx === -1) {
      return;
    }
    const member = this.members[idx];
    const members = [...this.members];
    members.splice(idx, 1);
    this.mutate({ members });
    // Flag all referencing files as dirty
    for (const ref of member.refs) {
      ref.file.dirty = true;
    }
    // member should be garbage collected now
  }

  /**
   * For container types that have non-named members, like arrays and DsTypes.
   * Can also be used for default Struct values. */
  addContainedType(type: Type | Type[]): this {
    // TODO: Need to get rid of this concept. A contained Union type is stable once added. Starting to feel circular...
    if (!this.contains) {
      this.mutate({ contains: new Type('Union') });
    }
    const contains = this.contains.slice();
    contains.push(type);
    return this.mutate({ contains });
  }

  /**
   * Create a derived type: of the same kind, pointing to
   * this type as its parent. */
  derive(): Type<T> {
    return new Type(this) as Type<T>;
  }

  named(name: string | undefined): this {
    return this.mutate({ name });
  }

  addRef(ref: Signifier) {
    this.refs.add(ref);
  }
}
