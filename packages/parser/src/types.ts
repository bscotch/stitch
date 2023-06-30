import { arrayWrapped, merge } from '@bscotch/utility';
import { typeToFeatherString } from './jsdoc.feather.js';
import { DefinedAt, Range } from './project.location.js';
import { Signifier } from './signifiers.js';
import { narrows } from './types.checks.js';
import { typeToHoverDetails, typeToHoverText } from './types.hover.js';
import {
  containerTypeNames,
  type ContainerTypeName,
  type PrimitiveName,
  type WithableTypeName,
} from './types.primitives.js';
import { assert, ok } from './util.js';

export type AnyType = Type<'Any'>;
export type ArrayType = Type<'Array'>;
export type BoolType = Type<'Bool'>;
export type FunctionType = Type<'Function'>;
export type PointerType = Type<'Pointer'>;
export type RealType = Type<'Real'>;
export type StringType = Type<'String'>;
export type StructType = Type<'Struct'>;
export type EnumType = Type<'Enum'>;
export type UndefinedType = Type<'Undefined'>;
export type WithableType = Type<WithableTypeName>;

/**
 * Collection of types, allowing things to reference the collection
 * instead of individual types. Types can be changed within the collection.
 */
export class AssignableType<T extends PrimitiveName = PrimitiveName> {
  readonly $tag = 'Assignableype';
  protected _types: Type<T>[] = [];

  def: DefinedAt = undefined;
  definedAt(location: Range | undefined): this {
    this.def = location;
    return this;
  }

  /** If this contains only one type, that type. Else throws. */
  get type(): Type<T> | undefined {
    assert(this.types.length === 1, 'AssignableType has more than one type');
    return this.types[0];
  }

  get types(): readonly Type<T>[] {
    return [...this._types];
  }

  /** If this contains only one type, its parent. */
  get parent(): Type<T> | undefined {
    return this.type?.parent;
  }

  /** The inferred kind, based on the collection of types. */
  get kind(): PrimitiveName {
    return this._types.length === 0
      ? 'Any'
      : this._types.length === 1
      ? this._types[0].kind
      : 'Mixed';
  }

  /** If this contains only one type, its `contains` value */
  get contains(): AssignableType | undefined {
    return this.type?.contains;
  }

  narrows(type: Type | AssignableType): boolean {
    return narrows(this, type);
  }

  toFeatherString(): string {
    return this.types.map((t) => t.toFeatherString()).join(' | ');
  }

  /**
   * Signifiers that are considered to be of this type. If this type changes,
   * then all signifiers must be informed of the change.
   */
  protected readonly refs: Set<Signifier> = new Set();
  addRef(ref: Signifier): this {
    this.refs.add(ref);
    return this;
  }
  setTypes(types: Type<T> | Type<T>[]): this {
    this._types = arrayWrapped(types);
    this.emitChanged();
    return this;
  }
  delete() {
    this.emitDeleted();
  }
  protected emitChanged() {
    // TODO: Alert all referrers
  }
  protected emitDeleted() {
    // TODO: Alert all referrers
  }
}

export interface TypeConfig<T extends PrimitiveName = PrimitiveName> {
  kind?: T | undefined;
  /**
   * Some types have names. It only counts as a name if it
   * cannot be parsed into types given the name alone.
   * E.g. `Array<String>` is not a name, but `Struct.MyStruct`
   * has the name `MyStruct`. */
  name?: string;
  /** "Container" types can list the types of the things they store. */
  contains?: AssignableType;
  /** For constructor functions, the struct type they generate */
  constructs?: StructType;
  /** The self context for a function */
  context?: StructType;
  members?: Signifier[];
  params?: Signifier[];
  returns?: AssignableType;
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
   * If set, then this Type is treated as a narrowing of the parent.
   * Useful for struct/constructor inheritence, as well
   * as for e.g. representing a subset of Real constants in a type. */
  parent: Type<T> | undefined = undefined;
  /**
   * Types created from this one using `extend()`, and therefore listing
   * this one as their `parent`. Child types can only narrow parent types.
   */
  protected readonly children: Set<Type<T>> = new Set();

  //#region Property getters
  get kind(): T {
    return this.config.kind || this.parent!.kind;
  }
  get name(): string | undefined {
    return this.config.name || this.parent?.name;
  }
  get contains(): T extends ContainerTypeName ? AssignableType : undefined {
    return (this.config.contains || this.parent?.contains) as any;
  }
  get constructs(): T extends 'Function' ? StructType : undefined {
    return (this.config.constructs || this.parent?.constructs) as any;
  }
  get context(): T extends 'Function' ? StructType : undefined {
    return (this.config.context || this.parent?.context) as any;
  }
  get params(): T extends 'Function' ? readonly Signifier[] : undefined {
    return (this.config.params || this.parent?.params) as any;
  }
  get returns(): T extends 'Function' ? AssignableType : undefined {
    return (this.config.returns || this.parent?.returns) as any;
  }
  //#endregion

  /** Returns self -- useful for compatibility with the AssignableType API */
  get type() {
    return this;
  }

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

  narrows(type: Type | AssignableType): boolean {
    return narrows(this, type);
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

  get isContainer(): boolean {
    return containerTypeNames.includes(this.kind as any);
  }

  setReturnType(type: Type | Type[]): this {
    ok(this.kind === 'Function', `Cannot add return type to ${this.kind}`);
    this.config.returns ||= new AssignableType();
    this.config.returns.setTypes(type);
    return this;
  }

  listParams(): readonly Signifier[] {
    return (this.params || []).filter((p) => p.idx !== undefined);
  }

  getParam(name: string): Signifier | undefined;
  getParam(idx: number): Signifier | undefined;
  getParam(nameOrIdx: string | number): Signifier | undefined {
    if (!this.params) {
      return undefined;
    }
    if (typeof nameOrIdx === 'string') {
      return this.params.find((p) => p.name === nameOrIdx);
    }
    return this.params[nameOrIdx];
  }

  setParam(idx: number, name: string, type: Type | Type[], optional = false) {
    ok(this.isFunction, `Cannot add param to ${this.kind} type`);
    const params = this.config.params || [];
    let param = this.getParam(name);
    const paramByIndex = this.getParam(idx);
    if (paramByIndex && paramByIndex !== param) {
      paramByIndex.idx = undefined;
    }
    if (!param) {
      param = new Signifier(this as FunctionType, name, type);
      param.local = true;
      param.optional = optional || name === '...';
      param.parameter = true;
    }
    param.idx = idx;
    param.type.setTypes(type);
    params[idx] = param;
    this.config.params = params;
    params.sort((a, b) => (a.idx || Infinity) - (b.idx || Infinity));
    return param;
  }

  listMembers(excludeParents = false): Signifier[] {
    if (excludeParents || !this.parent) {
      return [...(this.config.members || [])];
    }
    return [...(this.config.members || []), ...this.parent.listMembers()];
  }

  getMember(name: string): Signifier | undefined {
    return this.listMembers().find((m) => m.name === name);
  }

  /** For container types that have named members, like Structs and Enums */
  setMember(signifier: Signifier): Signifier;
  setMember(name: string, type: Type | Type[], writable?: boolean): Signifier;
  setMember(
    name: string | Signifier,
    type?: Type | Type[],
    writable = true,
  ): Signifier {
    let member: Signifier | undefined;
    if (typeof name === 'string') {
      ok(type, `Must provide a type for member ${name}`);
      // Only find OWNED members, not inherited ones
      member = this.config.members?.find((m) => m.name === name);
      if (!member) {
        member = new Signifier(this as StructType, name, type);
        member.writable = writable;
        this.config.members ||= [];
        this.config.members.push(member);
      } else {
        member.type.setTypes(type);
      }
    } else {
      ok(
        !this.config.members?.includes(name),
        `A signifier with the name ${name} already exists in this type`,
      );
      member = name;
      this.config.members ||= [];
      this.config.members.push(member);
    }
    return member;
  }

  removeMember(name: string) {
    // Only owned members!
    const idx = this.config.members?.findIndex((m) => m.name === name);
    if (idx === undefined || idx === -1) {
      return;
    }
    const members = [...this.config.members!];
    const member = members[idx];
    members.splice(idx, 1);
    member.delete();
    // Flag all referencing files as dirty

    // member should be garbage collected now
  }

  /**
   * For container types that have non-named members, like arrays and DsTypes.
   * Can also be used for default Struct values. */
  setContainedTypes(types: Type | Type[]): this {
    this.config.contains ||= new AssignableType();
    this.config.contains.setTypes(types);
    return this;
  }

  setContextType(type: StructType): this {
    ok(this.kind === 'Function', `Cannot add context type to ${this.kind}`);
    this.config.context = type;
    return this;
  }

  setName(name: string | undefined): this {
    if (!name) {
      return this;
    }
    ok(!this.config.name, 'Cannot rename type');
    this.config.name = name;
    return this;
  }

  /**
   * Create a derived type: of the same kind, pointing to
   * this type as its parent. */
  extend(): Type<T> {
    return new Type(this) as Type<T>;
  }

  toFeatherString(): string {
    return typeToFeatherString(this);
  }
}
