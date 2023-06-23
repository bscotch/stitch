import {
  typeToFeatherString,
  type FeatherType,
  type FeatherTypeUnion,
} from './jsdoc.feather.js';
import type { JsdocSummary } from './jsdoc.js';
import { Refs } from './project.location.js';
import { narrows } from './types.checks.js';
import {
  typeFromFeatherString,
  typeFromIdentifier,
  typeFromParsedFeatherString,
  typeFromParsedJsdocs,
} from './types.feather.js';
import { Flaggable } from './types.flags.js';
import { typeToHoverDetails, typeToHoverText } from './types.hover.js';
import { mergeTypes } from './types.merge.js';
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

export class MemberSignifier extends Refs(Flaggable) {
  readonly $tag = 'Member';
  description: string | undefined = undefined;
  // For function params
  idx: number | undefined = undefined;
  optional: undefined | boolean = undefined;
  /** The Type containing this member */
  readonly parent: Type;

  constructor(parent: Type, public name: string, public type: Type) {
    super();
    this.parent = parent;
  }

  describe(description: string | undefined) {
    this.description = description;
    return this;
  }
}

export class Type<T extends PrimitiveName = PrimitiveName> extends Refs(
  Flaggable,
) {
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
  _members: MemberSignifier[] | undefined = undefined;

  /** Types of the items found in arrays and various ds types, or the fallback type found in Structs */
  items: Type | undefined = undefined;

  /** The types making up a union */
  types: Type[] | undefined = undefined;

  // Applicable to Functions
  /**
   * If this is a constructor function, then this is the
   * type of the struct that it constructs. */
  constructs: Type<'Struct'> | undefined = undefined;
  context: Type<'Struct'> | undefined = undefined;
  _params: MemberSignifier[] | undefined = undefined;
  returns: undefined | Type = undefined;

  /** Create a shallow-ish clone */
  clone(): Type<T> {
    const clone = new Type<T>(this.kind as T);
    clone.name = this.name;
    clone.description = this.description;
    clone.parent = this.parent;
    clone._members = this._members ? [...this._members] : undefined;
    clone.items = this.items?.clone();
    clone.types = this.types ? [...this.types] : undefined;
    clone.constructs = this.constructs?.clone();
    clone.context = this.context?.clone();
    clone._params = this._params ? [...this._params] : undefined;
    clone.returns = this.returns?.clone();
    return clone;
  }

  /** Force-convert this type to another, even if those are incompatible. */
  coerceTo(type: Type): Type {
    this._kind = type.kind as any;
    this.name ||= type.name;
    this.description ||= type.description;
    if (this !== type.parent) {
      this.parent = type.parent as any;
    }
    this._members = type._members;
    this.items = type.items;
    this.types = type.types;
    this.constructs = type.constructs;
    this.context = type.context;
    this._params = type._params;
    this.returns = type.returns;
    this.def = type.def;
    return this;
  }

  constructor(protected _kind: T) {
    super();
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

  get code() {
    return typeToHoverText(this);
  }

  get details() {
    return typeToHoverDetails(this);
  }

  get isFunction() {
    return ['Constructor', 'Function'].includes(this.kind);
  }

  addReturnType(type: Type) {
    ok(this.kind === 'Function', `Cannot add return type to ${this.kind}`);
    if (!this.returns) {
      this.returns = type;
      return this;
    }
    if (this.returns.kind !== 'Union') {
      const union = new Type('Union').addUnionType(this.returns);
      this.returns = union;
    }
    this.returns.addUnionType(type);
    return this;
  }

  listParameters(): MemberSignifier[] {
    return this._params ? [...this._params] : [];
  }

  getParameter(name: string): MemberSignifier | undefined;
  getParameter(idx: number): MemberSignifier | undefined;
  getParameter(nameOrIdx: string | number): MemberSignifier | undefined {
    if (!this._params) {
      return undefined;
    }
    if (typeof nameOrIdx === 'string') {
      return this._params.find((p) => p.name === nameOrIdx);
    }
    return this._params[nameOrIdx];
  }

  addParameter(idx: number, name: string, type: Type, optional = false) {
    ok(this.isFunction, `Cannot add param to ${this.kind} type`);
    this._params ??= [];
    let param = this._params[idx];
    if (!param) {
      param = new MemberSignifier(this, name, type);
      this._params[idx] = param;
    }
    param.idx = idx;
    param.local = true;
    param.name = name;
    param.optional = optional || name === '...';
    param.parameter = true;
    if (param.type) {
      param.type.coerceTo(type);
    } else {
      param.type = type;
    }
    return param;
  }

  listMembers(excludeParents = false): MemberSignifier[] {
    const members = this._members || [];
    if (excludeParents || !this.parent) {
      return members;
    }
    return [...members, ...this.parent.listMembers()];
  }

  getMember(name: string): MemberSignifier | undefined {
    return (
      this._members?.find((m) => m.name === name) ||
      this.parent?.getMember(name)
    );
  }

  /** For container types that have named members, like Structs and Enums */
  addMember(name: string, type: Type, writable = true): MemberSignifier {
    this._members ??= [];
    let member = this._members.find((m) => m.name === name);
    if (!member) {
      member = new MemberSignifier(this, name, type);
      member.writable = writable;
      this._members.push(member);
    } else {
      member.type.coerceTo(type);
    }
    return member;
  }

  removeMember(name: string) {
    const idx = this._members?.findIndex((m) => m.name === name);
    if (idx === undefined || idx === -1) {
      return;
    }
    const member = this._members![idx];
    this._members!.splice(idx, 1);
    // Flag all referencing files as dirty
    for (const ref of member.refs) {
      ref.file.dirty = true;
    }
    // member should be garbage collected now
  }

  addUnionType(type: Type): this {
    ok(this.kind === 'Union', `Cannot add union type to ${this.kind}`);
    this.types ??= [];
    this.types.push(type);
    return this;
  }

  /**
   * For container types that have non-named members, like arrays and DsTypes.
   * Can also be used for default Struct values. */
  addItemType(type: Type): this {
    if (!this.items) {
      this.items = type;
      return this;
    }
    if (this.items.kind !== 'Union') {
      const union = new Type('Union').addUnionType(this.items);
      this.items = union;
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
   */
  static merge(original: Type | undefined, withType: Type): Type {
    return mergeTypes(original, withType);
  }

  /** Given a Feather-compatible type string, get a fully parsed type. */
  static fromFeatherString(
    typeString: string,
    knownTypes: Map<string, Type>,
  ): Type {
    return typeFromFeatherString(typeString, knownTypes);
  }

  static fromParsedFeatherString(
    node: FeatherTypeUnion | FeatherType,
    knownTypes: Map<string, Type>,
  ): Type {
    return typeFromParsedFeatherString(node, knownTypes);
  }

  static fromParsedJsdocs(
    jsdoc: JsdocSummary,
    knownTypes: Map<string, Type>,
  ): Type {
    return typeFromParsedJsdocs(jsdoc, knownTypes);
  }

  static fromIdentifier(
    identifier: string,
    knownTypes: Map<string, Type>,
    __isRootRequest = true,
  ): Type {
    return typeFromIdentifier(identifier, knownTypes, __isRootRequest);
  }

  toJSON() {
    return {
      $tag: this.$tag,
      kind: this.kind,
      parent: this.parent,
      members: this.listMembers(),
      items: this.items,
      types: this.types,
      context: this.context,
      params: this.listParameters(),
      returns: this.returns,
    };
  }
}
