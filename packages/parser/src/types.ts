import { arrayWrapped } from '@bscotch/utility';
import { typeToFeatherString } from './jsdoc.feather.js';
import { Signifier } from './signifiers.js';
import { getTypes, narrows } from './types.checks.js';
import { typeFromFeatherString } from './types.feather.js';
import { Flags } from './types.flags.js';
import { typeToHoverDetails, typeToHoverText } from './types.hover.js';
import { PrimitiveName, withableTypes } from './types.primitives.js';
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
export type WithableType = Type<(typeof withableTypes)[number]>;

/**
 * A stable entity that represents a type. It should be used
 * as the referenced container for any type information, so
 * that the types can be changed within the container without
 * breaking references.
 */
export class TypeStore<T extends PrimitiveName = PrimitiveName> extends Flags {
  readonly $tag = 'TypeStore';
  protected _types: Type<T>[] = [];

  constructor() {
    super();
  }

  /** If this store has only one type, its kind. Else throws. */
  get kind() {
    if (this.type.length === 0) {
      return 'Undefined';
    } else if (this.type.length > 1) {
      return 'Mixed';
    }
    return this.type[0].kind;
  }

  get type(): Type<T>[] {
    return [...this._types];
  }
  set type(types: Type<T> | Type<T>[] | undefined) {
    this._types = arrayWrapped(types);
  }

  get constructs(): StructType[] {
    return this.type
      .map((t) => t.constructs)
      .filter((x) => !!x) as StructType[];
  }

  get items(): TypeStore[] {
    return this.type.map((t) => t.items).filter((x) => !!x) as TypeStore[];
  }

  get returns(): TypeStore[] {
    return this.type.map((t) => t.returns).filter((x) => !!x) as TypeStore[];
  }

  /**
   * Should be used sparingly, since it means we're adding types in multiple steps instead of all at once.
   */
  addType(type: Type<T> | Type<T>[]): this {
    this.type = [...this.type, ...arrayWrapped(type)];
    return this;
  }

  narrows(other: TypeStore | Type | Type[]): boolean {
    return narrows(this, other);
  }

  toFeatherString(): string {
    const typeStrings = [
      ...new Set(this.type.map((t) => t.toFeatherString())),
    ].sort((a, b) => a.localeCompare(b));
    return typeStrings.join('|') || 'Any';
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
  /** Signifiers associated with this type. */
  _signifier: Signifier | undefined = undefined;

  /**
   * If set, then this Type is treated as a subset of the parent.
   * It will only "match" another type if that type is in its
   * parent somewhere. Useful for struct/constructor inheritence, as well
   * as for e.g. representing a subset of Real constants in a type. */
  parent: Type | undefined = undefined;

  /**
   * Native and primitive types are typically read-only once
   * they've been defined. This property should be set once a type
   * is intended to be immutable.
   */
  readonly = false;
  /**
   * If this is a type used as a generic, then this will be true
   */
  generic = false;

  /** Named members of Structs and Enums */
  protected _members: Map<string, Signifier> | undefined = undefined;

  /** Types of the items found in arrays and various ds types, or the fallback type found in Structs */
  items: TypeStore | undefined = undefined;

  // Applicable to Functions
  /**
   * If this is a constructor function, then this is the
   * type of the struct that it constructs. */
  constructs: Type<'Struct'> | undefined = undefined;
  context: WithableType | undefined = undefined;
  protected _params: Signifier[] | undefined = undefined;
  returns: TypeStore | undefined = undefined;

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

  get signifier(): Signifier | undefined {
    return this._signifier;
  }
  set signifier(signifier: Signifier) {
    // assert(!this._signifier, 'Cannot change type signifier');
    this._signifier = signifier;
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
    return this.kind === 'Function';
  }

  get isConstructor() {
    return this.kind === 'Function' && !!this.constructs;
  }

  setReturnType(type: Type | TypeStore | (Type | TypeStore)[]) {
    this.returns ||= new TypeStore();
    const types = getTypes(type);
    this.returns.type = types;
    return this;
  }

  /** Prefer `setReturnType` where possible */
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
    type?: Type | Type[],
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
    if (type) {
      param.setType(type);
    }
    return param;
  }

  totalMembers(excludeParents = false): number {
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.parent?.totalMembers(excludeParents) || 0;
    }
    if (excludeParents || !this.parent) {
      return this._members?.size || 0;
    }
    return (
      (this._members?.size || 0) + this.parent.totalMembers(excludeParents)
    );
  }

  listMembers(excludeParents = false): Signifier[] {
    // Handle pass-through types
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.parent?.listMembers(excludeParents) || [];
    }
    const members = this._members?.values() || [];
    if (excludeParents || !this.parent) {
      return [...members];
    }
    return [...members, ...this.parent.listMembers()];
  }

  getMember(name: string, excludeParents = false): Signifier | undefined {
    // Handle pass-through types
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.parent?.getMember(name, excludeParents);
    }
    return (
      this._members?.get(name) ||
      (excludeParents ? undefined : this.parent?.getMember(name))
    );
  }

  /** For container types that have named members, like Structs and Enums */
  addMember(signifier: Signifier): Signifier | undefined;
  addMember(
    name: string,
    type?: Type | Type[],
    writable?: boolean,
  ): Signifier | undefined;
  addMember(
    ...args: [
      name: string | Signifier,
      type?: Type | Type[],
      writable?: boolean,
    ]
  ): Signifier | undefined {
    // If this is an immutable type, then we can't add members to it.
    if (this.readonly) {
      return;
    }

    // If this is a Id.Instance or Asset.GMObject type, then we want to add
    // the member to the parent Struct instead.

    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      // @ts-expect-error
      return this.parent?.addMember(...args);
    }
    const name = args[0];
    const type = args[1];
    const writable = args[2];

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
    if (type) {
      member.setType(type);
    }
    return member;
  }

  /**
   * Replace a member, ensuring that all references are updated to
   * point to the new member.
   */
  replaceMember(newMember: Signifier): Signifier | undefined {
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.parent?.replaceMember(newMember);
    }
    const existing = this.getMember(newMember.name, true);
    if (!existing) {
      return this.addMember(newMember);
    }
    // Update all of the original refs to point to this signifier,
    // and add them to the new member. That way wherever they are
    // being reference elsewhere they'll now be accurate.
    for (const ref of existing.refs) {
      ref.item = newMember;
      newMember.refs.add(ref);
      ref.file.dirty = true;
    }
    // TODO: There may be some jank here related to inheritance...
    this._members ||= new Map();
    this._members.set(newMember.name, newMember);
    return newMember;
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
    this.items.addType(type);
    return this;
  }

  /**
   * Create a derived type: of the same kind, pointing to
   * this type as its parent. */
  derive(): Type<T> {
    const derived = new Type(this.kind) as Type<T>;
    derived.parent = this;
    derived.name = this.name;
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

  /** Given a Feather-compatible type string, get a fully parsed type. */
  static fromFeatherString(
    typeString: string,
    knownTypes: Map<string, Type>,
    addMissing: boolean,
  ): Type[] {
    return typeFromFeatherString(typeString, knownTypes, addMissing);
  }

  static get Any() {
    return new Type('Any');
  }
}
