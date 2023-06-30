import { arrayWrapped } from '@bscotch/utility';
import { typeToFeatherString } from './jsdoc.feather.js';
import { Signifier } from './signifiers.js';
import { narrows } from './types.checks.js';
import { typeFromFeatherString } from './types.feather.js';
import { Flaggable } from './types.flags.js';
import { typeToHoverDetails, typeToHoverText } from './types.hover.js';
import { mergeTypes } from './types.merge.js';
import { PrimitiveName } from './types.primitives.js';
import { assert, ok } from './util.js';

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
export type UnknownType = Type<'Unknown'>;

/**
 * A stable entity that represents a type. It should be used
 * as the referenced container for any type information, so
 * that the types can be changed within the container without
 * breaking references.
 */
export class TypeStore<
  T extends PrimitiveName = PrimitiveName,
> extends Flaggable {
  readonly $tag = 'TypeStore';
  protected _types: Type<T>[] = [];

  constructor(types?: Type<T> | Type<T>[]) {
    super();
    this.types = types;
  }

  get types(): readonly Type<T>[] {
    return this._types;
  }
  set types(types: Type<T> | Type<T>[] | undefined) {
    this._types = arrayWrapped(types);
  }

  /**
   * Should be used sparingly, since it means we're adding types in multiple steps instead of all at once.
   * @deprecated
   */
  addType(type: Type<T> | Type<T>[]): this {
    this.types = [...this.types, ...arrayWrapped(type)];
    return this;
  }

  narrows(other: TypeStore | Type | Type[]): boolean {
    return narrows(this, other);
  }

  toFeatherString(): string {
    return this.types.map((t) => typeToFeatherString(t)).join('|');
  }
}

export class Type<T extends PrimitiveName = PrimitiveName> {
  readonly $tag = 'Type';
  // Some types have names. It only counts as a name if it
  // cannot be parsed into types given the name alone.
  // E.g. `Array<String>` is not a name, but `Struct.MyStruct`
  // results in the name `MyStruct`.
  name: string | undefined = undefined;
  description: string | undefined = undefined;
  /**
   * If set, then this Type is treated as a subset of the parent.
   * It will only "match" another type if that type is in its
   * parent somewhere. Useful for struct/constructor inheritence, as well
   * as for e.g. representing a subset of Real constants in a type. */
  parent: Type<T> | undefined = undefined;

  /** Named members of Structs and Enums */
  _members: Map<string, Signifier> | undefined = undefined;

  /** Types of the items found in arrays and various ds types, or the fallback type found in Structs */
  items: TypeStore | undefined = undefined;

  // Applicable to Functions
  /**
   * If this is a constructor function, then this is the
   * type of the struct that it constructs. */
  constructs: Type<'Struct'> | undefined = undefined;
  context: Type<'Struct'> | undefined = undefined;
  _params: Signifier[] | undefined = undefined;
  returns: TypeStore | undefined = undefined;

  /**
   * Create a shallow-ish clone
   * @deprecated Difficult to understand consequences
   */
  clone(): Type<T> {
    const clone = new Type<T>(this.kind as T);
    clone.name = this.name;
    clone.description = this.description;
    clone.parent = this.parent;
    clone._members = this._members;
    clone.items = this.items;
    clone.constructs = this.constructs?.clone();
    clone.context = this.context?.clone();
    clone._params = this._params ? [...this._params] : undefined;
    clone.returns = this.returns;
    return clone;
  }

  /**
   * Force-convert this type to another, even if those are incompatible.
   * @deprecated Types should be immutable -- they should be replaced in a TypeStore instead.
   */
  coerceTo(type: Type): Type {
    this._kind = type.kind as any;
    this.name ||= type.name;
    this.description ||= type.description;
    if (this !== type.parent) {
      this.parent = type.parent as any;
    }
    this._members = type._members;
    this.items = type.items;
    this.constructs = type.constructs;
    this.context = type.context;
    this._params = type._params;
    this.returns = type.returns;
    return this;
  }

  constructor(protected _kind: T) {}

  get kind() {
    return this._kind;
  }
  set kind(newKind: PrimitiveName) {
    ok(
      this._kind === 'Unknown' || this._kind === newKind,
      'Cannot change type kind',
    );
    this._kind = newKind as T;
  }

  get canBeSelf() {
    return ['Struct', 'Id.Instance', 'Asset.GMObject'].includes(this.kind);
  }

  /** If this type narrows `other` type, returns `true` */
  narrows(other: Type | Type[] | TypeStore): boolean {
    return narrows(this, other);
  }

  /** Get this type as a Feather-compatible string */
  toFeatherString(): string {
    return typeToFeatherString(this);
  }

  get code() {
    return typeToHoverText(this);
  }

  get details() {
    return typeToHoverDetails(this);
  }

  get isFunction() {
    return ['Constructor', 'Function'].includes(this.kind);
  }

  addReturnType(type: Type | Type[]) {
    ok(this.isFunction, `Cannot add return type to ${this.kind}`);
    this.returns ||= new TypeStore();
    this.returns.addType(type);
    return this;
  }

  listParameters(): Signifier[] {
    return (this._params || []).filter((p) => p.idx !== undefined);
  }

  getParameter(name: string): Signifier | undefined;
  getParameter(idx: number): Signifier | undefined;
  getParameter(nameOrIdx: string | number): Signifier | undefined {
    if (!this._params) {
      return undefined;
    }
    if (typeof nameOrIdx === 'string') {
      return this._params.find((p) => p.name === nameOrIdx);
    }
    return this._params[nameOrIdx];
  }

  addParameter(
    idx: number,
    name: string,
    type: Type | Type[],
    optional = false,
  ): Signifier {
    assert(this.isFunction, `Cannot add param to ${this.kind} type`);
    const param = this.getParameter(name) || new Signifier(this, name);
    if (this._params?.[idx] && this._params[idx] !== param) {
      // Then we're overriding by position
      this._params[idx].idx = undefined;
    }
    this._params ??= [];
    this._params[idx] = param;
    param.idx = idx;
    param.local = true;
    param.optional = optional || name === '...';
    param.parameter = true;
    param.type.types = type;
    return param;
  }

  listMembers(excludeParents = false): Signifier[] {
    const members = this._members?.values() || [];
    if (excludeParents || !this.parent) {
      return [...members];
    }
    return [...members, ...this.parent.listMembers()];
  }

  getMember(name: string, excludeParents = false): Signifier | undefined {
    return (
      this._members?.get(name) ||
      (excludeParents ? undefined : this.parent?.getMember(name))
    );
  }

  /** For container types that have named members, like Structs and Enums */
  addMember(signifier: Signifier): Signifier;
  addMember(name: string, type: Type, writable?: boolean): Signifier;
  addMember(
    name: string | Signifier,
    type?: Type,
    writable?: boolean,
  ): Signifier {
    const member =
      (typeof name === 'string' ? this._members?.get(name) : name) ||
      new Signifier(this, name as string);
    const existing = this.getMember(member.name, true);
    assert(
      !existing || existing === member,
      'Cannot add member with same name as existing member',
    );
    this._members ??= new Map();
    this._members.set(member.name, member);

    member.writable = writable ?? true;
    member.type.types = type;
    return member;
  }

  removeMember(name: string) {
    const member = this.getMember(name, true);
    if (!member) {
      return;
    }
    this._members!.delete(name);
    // Flag all referencing files as dirty
    for (const ref of member.refs) {
      ref.file.dirty = true;
    }
  }

  /**
   * For container types that have non-named members, like arrays and DsTypes.
   * Can also be used for default Struct values. */
  addItemType(type: Type): this {
    this.items ||= new TypeStore();
    this.items.types = type;
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
    this.name = name;
    return this;
  }

  describe(description: string | undefined): this {
    this.description = description;
    return this;
  }

  /**
   * If this type is unknown, change it to the provided Type.
   * If it is a union, add the provided Type to the union.
   * If it is not a union, create a union and return that.
   *
   * **WARNING**: This method sometimes mutates the original type, and sometimes returns a new type.
   *
   * @deprecated
   */
  static merge(original: Type | undefined, withType: Type): Type {
    return mergeTypes(original, withType);
  }

  /** Given a Feather-compatible type string, get a fully parsed type. */
  static fromFeatherString(
    typeString: string,
    knownTypes: Map<string, Type>,
  ): Type[] {
    return typeFromFeatherString(typeString, knownTypes);
  }
}
