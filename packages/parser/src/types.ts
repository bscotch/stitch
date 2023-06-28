import { merge } from '@bscotch/utility';
import { typeToFeatherString } from './jsdoc.feather.js';
import { Signifier } from './signifiers.js';
import { narrows } from './types.checks.js';
import { typeToHoverDetails, typeToHoverText } from './types.hover.js';
import { PrimitiveName } from './types.primitives.js';
import { ok } from './util.js';

export type AnyType = Type<'Any'>;
export type ArrayType = Type<'Array'>;
export type BoolType = Type<'Bool'>;
export type EnumType = Type<'Enum'>;
export type FunctionType = Type<'Function'>;
export type PointerType = Type<'Pointer'>;
export type RealType = Type<'Real'>;
export type StringType = Type<'String'>;
export type StructType = Type<'Struct'>;
export type UndefinedType = Type<'Undefined'>;
export type UnionType = Type<'Union'>;
export type UnknownType = Type<'Unknown'>;

export interface TypeConfig<T extends PrimitiveName = PrimitiveName> {
  kind?: T;
  /**
   * Some types have names. It only counts as a name if it
   * cannot be parsed into types given the name alone.
   * E.g. `Array<String>` is not a name, but `Struct.MyStruct`
   * results in the name `MyStruct`. */
  name?: string;
  items?: Type;
  /** For type unions */
  types?: Type[];
  constructs?: Type<'Struct'>;
  context?: Type<'Struct'>;
  members?: Signifier[];
  params?: Signifier[];
  returns?: Type;
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
  get items(): Type | undefined {
    return this.config.items || this.parent?.items;
  }
  get types(): Type[] {
    return this.config.types || this.parent?.types || [];
  }
  get constructs(): Type<'Struct'> | undefined {
    return this.config.constructs || this.parent?.constructs;
  }
  get context(): Type<'Struct'> | undefined {
    return this.config.context || this.parent?.context;
  }
  get members(): readonly Signifier[] {
    return this.config.members || this.parent?.members || [];
  }
  get params(): readonly Signifier[] {
    return this.config.params || this.parent?.params || [];
  }
  get returns(): Type | undefined {
    return this.config.returns || this.parent?.returns;
  }
  //#endregion

  constructor(kind: T);
  constructor(config: TypeConfig<T>);
  constructor(fromParent: Type<T>);
  constructor(kind: T | TypeConfig<T> | Type<T>) {
    this.config =
      typeof kind === 'string' ? { kind } : kind instanceof Type ? {} : kind;
    if (kind instanceof Type) {
      this.parent = kind;
      this.parent.children.add(this);
    }
  }

  get canBeSelf() {
    return ['Struct', 'Id.Instance', 'Asset.GMObject'].includes(this.kind);
  }

  /** If this type narrows `other` type, returns `true` */
  narrows(other: Type): boolean {
    return narrows(this, other);
  }

  /** Get this type as a Feather-compatible string */
  toFeatherString(): string {
    return typeToFeatherString(this);
  }

  get code(): string {
    return typeToHoverText(this);
  }

  get details(): string {
    return typeToHoverDetails(this);
  }

  get isFunction(): boolean {
    return ['Constructor', 'Function'].includes(this.kind);
  }

  addReturnType(type: Type): this {
    ok(this.kind === 'Function', `Cannot add return type to ${this.kind}`);
    if (!this.returns) {
      return this.mutate({ returns: type });
    }
    if (this.returns.kind !== 'Union') {
      const union = new Type('Union').addUnionType(this.returns);
      return this.mutate({ returns: union });
    }
    this.returns.addUnionType(type);
    return this;
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

  addParameter(idx: number, name: string, type: Type, optional = false) {
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
    param.type = type;
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

  addUnionType(type: Type): this {
    ok(this.kind === 'Union', `Cannot add union type to ${this.kind}`);
    const types = [...this.types];
    types.push(type);
    return this.mutate({ types });
  }

  /**
   * For container types that have non-named members, like arrays and DsTypes.
   * Can also be used for default Struct values. */
  addItemType(type: Type): this {
    if (!this.items) {
      return this.mutate({ items: type });
    }
    if (this.items.kind !== 'Union') {
      const union = new Type('Union').addUnionType(this.items);
      this.mutate({ items: union });
    }
    this.items.addUnionType(type);
    return this;
  }

  /**
   * Create a derived type: of the same kind, pointing to
   * this type as its parent. */
  derive(): Type<T> {
    const derived = new Type(this.kind) as Type<T>;
    derived.parent = this;
    return derived;
  }

  named(name: string | undefined): this {
    return this.mutate({ name });
  }
}
