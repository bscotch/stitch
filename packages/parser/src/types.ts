import { arrayWrapped } from '@bscotch/utility';
import { typeToFeatherString } from './jsdoc.feather.js';
import { Flags } from './signifiers.flags.js';
import { Signifier } from './signifiers.js';
import { getTypes, narrows } from './types.checks.js';
import {
  typeFromFeatherString,
  type KnownOrGenerics,
  type KnownTypesMap,
} from './types.feather.js';
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

  get hasTypes() {
    return this._types.length > 0;
  }

  get constructs(): StructType[] {
    return this.type
      .map((t) => (t.isConstructor ? t.self : undefined))
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

const typeFlags = {
  READONLY: 1 << 0,
  GENERIC: 1 << 1,
  CONSTRUCTOR: 1 << 2,
};

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
  protected _extends: Type | undefined = undefined;
  protected _derived: Set<Type> | undefined = undefined;

  protected flags = 0;

  /** Named members of Structs and Enums */
  protected _members: Map<string, Signifier> | undefined = undefined;

  /** Types of the items found in arrays and various ds types, or the fallback type found in Structs */
  items: TypeStore | undefined = undefined;

  // Applicable to Functions
  /**
   * For functions, the local variables declared within the function.
   * A subset of these will be parameters, which are also signifiers.
   */
  local: Type<'Struct'> | undefined = undefined;
  /**
   * If this is a constructor function, then this is the
   * type of the struct that it constructs.
   * Otherwise it's the self-context of the function */
  self: WithableType | undefined = undefined;
  returns: TypeStore | undefined = undefined;

  constructor(protected _kind: T) {}

  protected setFlag(flag: number, value: boolean) {
    if (value) {
      this.flags |= flag;
    } else {
      this.flags &= ~flag;
    }
  }
  protected getFlag(flag: number) {
    return !!(this.flags & flag);
  }

  /**
   * Native and primitive types are typically read-only once
   * they've been defined. This property should be set once a type
   * is intended to be immutable.
   */
  get isReadonly() {
    return this.getFlag(typeFlags.READONLY);
  }
  set isReadonly(value: boolean) {
    this.setFlag(typeFlags.READONLY, value);
  }
  /**
   * If this is a type used as a generic, then this will be true
   */
  get isGeneric() {
    return this.getFlag(typeFlags.GENERIC);
  }
  set isGeneric(value: boolean) {
    this.setFlag(typeFlags.GENERIC, value);
  }
  get isConstructor() {
    return this.getFlag(typeFlags.CONSTRUCTOR);
  }
  set isConstructor(value: boolean) {
    this.setFlag(typeFlags.CONSTRUCTOR, value);
  }

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
    return this._signifier || this.extends?.signifier;
  }
  set signifier(signifier: Signifier) {
    // assert(!this._signifier, 'Cannot change type signifier');
    this._signifier = signifier;
  }

  get extends() {
    return this._extends;
  }
  set extends(type: Type | undefined) {
    const oldParent = this._extends;
    this._extends = type;
    oldParent?._derived?.delete(this);
    if (this._extends) {
      this._extends._derived ||= new Set();
      this._extends._derived.add(this);
    }
  }
  listDerived(recursive = false): Type[] {
    if (!this._derived) {
      return [];
    }
    const derived = [...this._derived];
    if (recursive) {
      for (const child of this._derived) {
        derived.push(...child.listDerived(true));
      }
    }
    return derived;
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

  listParameters(): (Signifier | undefined)[] {
    // Get the subset of local members that are parameters,
    // and sort them by their index.
    const params =
      this.local
        ?.listMembers(true)
        .filter((m) => m.parameter && typeof m.idx === 'number') || [];
    // Instead of sorting by index, we want to guarantee that the index positions
    // *actually match*.
    const sorted = Array(params.length);
    for (const param of params) {
      sorted[param.idx!] = param;
    }
    return sorted;
  }

  getParameter(name: string): Signifier | undefined;
  getParameter(idx: number): Signifier | undefined;
  getParameter(nameOrIdx: string | number): Signifier | undefined {
    const params = this.listParameters();
    if (typeof nameOrIdx === 'string') {
      return params.find((p) => p?.name === nameOrIdx);
    }
    return params[nameOrIdx];
  }

  /** A parameter is a special type of local variable. */
  addParameter(
    idx: number,
    nameOrParam: string | Signifier,
    options?: {
      type?: Type | Type[];
      optional?: boolean;
    },
  ): Signifier {
    assert(this.isFunction, `Cannot add param to ${this.kind} type`);
    const name =
      typeof nameOrParam === 'string' ? nameOrParam : nameOrParam.name;
    let param = this.local?.getMember(name, true);
    const existingAtThisIndex = this.getParameter(idx);

    // Create the signifier if we need to
    if (!param) {
      this.local ||= Type.Struct;
      param = this.local.addMember(nameOrParam)!;
      assert(
        param.parent === this.local,
        'Param incorrectly added -- has the wrong parent',
      );
    }

    // Handle positional conflicts. If there is a param at this index already,
    // unset its index so that it doesn't conflict with this one.
    if (existingAtThisIndex && existingAtThisIndex !== param) {
      existingAtThisIndex.idx = undefined;
    }
    param.idx = idx;
    param.local = true;
    param.parameter = true;
    param.optional = options?.optional || name === '...';
    if (options?.type) {
      param.setType(options.type);
    }
    return param;
  }

  truncateParameters(count: number) {
    this.listParameters().forEach((p) => {
      if (p?.idx !== undefined && p.idx >= count) {
        p.idx = undefined;
      }
    });
  }

  totalMembers(excludeParents = false): number {
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.extends?.totalMembers(excludeParents) || 0;
    }
    if (excludeParents || !this.extends) {
      return this._members?.size || 0;
    }
    return (
      (this._members?.size || 0) + this.extends.totalMembers(excludeParents)
    );
  }

  listMembers(excludeParents = false): Signifier[] {
    // Handle pass-through types
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.extends?.listMembers(excludeParents) || [];
    }
    const members = this._members?.values() || [];
    if (excludeParents || !this.extends) {
      return [...members];
    }
    return [...members, ...this.extends.listMembers()];
  }

  getMember(name: string, excludeParents = false): Signifier | undefined {
    // Handle pass-through types
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.extends?.getMember(name, excludeParents);
    }
    if (excludeParents) {
      return this._members?.get(name);
    }
    return this._members?.get(name) || this.extends?.getMember(name);
  }

  /** For container types that have named members, like Structs and Enums */
  addMember(
    newMember: Signifier | string,
    options?: {
      type?: Type | Type[];
      writable?: boolean;
      override?: boolean;
    },
  ): Signifier | undefined {
    // If this is a Id.Instance or Asset.GMObject type, then we want to add
    // the member to the parent Struct instead.
    if (this.kind === 'Id.Instance' || this.kind === 'Asset.GMObject') {
      return this.extends?.addMember(newMember, options);
    }
    // If this is an immutable type, then we can't add members to it.
    if (this.isReadonly) {
      return;
    }

    const type = options?.type;

    const name = typeof newMember === 'string' ? newMember : newMember.name;
    const signifierArg = typeof newMember === 'string' ? undefined : newMember;

    // Only add if this doesn't exist on *any parent*
    const existing = this.getMember(name, false);
    assert(
      !existing ||
        !signifierArg ||
        existing === signifierArg ||
        signifierArg.override ||
        options?.override,
      'Cannot replace existing member with new member',
    );
    const existingOnThis = this.getMember(name, true);

    let member: Signifier | undefined;
    if (signifierArg?.override || (signifierArg && options?.override)) {
      // Then we want to override the existing member
      member = signifierArg;
    } else {
      // Then we want to preferentially use the existing member
      member = existing || signifierArg;
      if (!member) {
        member = new Signifier(this, name);
        member.override = !!options?.override;
        member.writable = options?.writable ?? true;
        if (type) {
          member.setType(type);
        }
      }
    }
    if (member !== existing) {
      this._members ??= new Map();
      // If the existing member has no def, then replace it
      // and transfer its refs
      if (existingOnThis) {
        for (const ref of existingOnThis.refs) {
          ref.item = member;
          ref.isDef = false; // Definition must come from rootmost
          member.refs.add(ref);
          ref.file.dirty = true;
        }
      }

      this._members.set(member.name, member);
      // Ensure that all children of this parent are referencing
      // the same root-most member.
      this.replaceMemberInChildren(member);
    }
    return member;
  }

  protected replaceMemberInChildren(member: Signifier) {
    for (const child of this.listDerived()) {
      const toReplace = child._members?.get(member.name);
      if (toReplace?.override) {
        // Then we skip this and all descendents of it
        continue;
      }
      if (toReplace) {
        // Remove from the child
        child._members!.delete(member.name);
        // Inherit its refs
        for (const ref of toReplace.refs) {
          ref.item = member;
          ref.isDef = false; // Definition must come from rootmost
          member.refs.add(ref);
          ref.file.dirty = true;
        }
      }
      // Continue down the tree
      child.replaceMemberInChildren(member);
    }
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
   * For container types that have non-named members, like arrays and DsTypes.
   * Can also be used for default Struct values. */
  setItemType(type: Type): this {
    this.items ||= new TypeStore();
    this.items.type = type;
    return this;
  }

  /**
   * Create a derived type: of the same kind, pointing to
   * this type as its parent. */
  derive(): Type<T> {
    const derived = new Type(this.kind) as Type<T>;
    derived.extends = this;
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

  genericize(): this {
    this.isGeneric = true;
    return this;
  }

  /** Given a Feather-compatible type string, get a fully parsed type. */
  static fromFeatherString(
    typeString: string,
    knownTypes: KnownTypesMap | KnownOrGenerics[],
    addMissing: boolean,
  ): Type[] {
    return typeFromFeatherString(typeString, knownTypes, addMissing);
  }

  static get Any() {
    return new Type('Any');
  }

  static get Real() {
    return new Type('Real');
  }

  static get String() {
    return new Type('String');
  }

  static get Bool() {
    return new Type('Bool');
  }

  static get Undefined() {
    return new Type('Undefined');
  }

  static get Struct() {
    return new Type('Struct');
  }

  static get Function() {
    return new Type('Function');
  }
}
