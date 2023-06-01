import { ok } from 'assert';
import { JsdocTypeCstNode, JsdocTypeUnionCstNode } from '../gml-cst.js';
import { parser } from './parser.js';
import { Flaggable } from './project.flags.js';
import { Refs } from './project.location.js';
import { PrimitiveName, primitiveNames } from './project.primitives.js';

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

export class TypeMember extends Refs(Flaggable) {
  readonly $tag = 'TypeMember';
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

  // Applicable to Structs and Enums
  members: TypeMember[] | undefined = undefined;

  // Applicable to Arrays
  items: Type | undefined = undefined;

  // Applicable to Unions
  types: Type[] | undefined = undefined;

  // Applicable to Functions
  /**
   * If this is a constructor function, then this is the
   * type of the struct that it constructs. */
  constructs: Type<'Struct'> | undefined = undefined;
  context: Type<'String'> | undefined = undefined;
  params: TypeMember[] | undefined = undefined;
  returns: undefined | Type = undefined;

  constructor(protected _kind: T) {
    super();
  }

  get kind() {
    return this._kind;
  }
  set kind(value: PrimitiveName) {
    ok(this._kind === 'Unknown', 'Cannot change type kind');
    this._kind = value as T;
  }

  /** Get this type as a Feather-compatible string */
  toFeatherString(): string {
    // Functions, Structs, and Enums are the only types that can have names
    if (['Function', 'Struct', 'Enum'].includes(this.kind)) {
      if (this.name) {
        return `${this.kind}.${this.name}`;
      }
      return this.kind;
    }
    // Arrays etc can contain items of a type
    if (this.canHaveItems) {
      if (this.items) {
        return `${this.kind}<${this.items.toFeatherString()}>`;
      }
      return this.kind;
    }
    // Unions can list types
    if (this.kind === 'Union') {
      if (this.types) {
        return this.types.map((t) => t.toFeatherString()).join(' | ');
      }
      return 'Mixed';
    }
    return this.kind;
  }

  get code() {
    let code = '';
    switch (this.kind) {
      case 'Function':
        code = `function ${this.name || ''}(`;
        const params = this.params || [];
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          if (i > 0) {
            code += ', ';
          }
          code += param.name;
          if (param.optional) {
            code += '?';
          }
          if (param.type.kind !== 'Unknown') {
            code += ': ' + param.type.toFeatherString();
          }
        }
        code += ')';
        if (this.constructs && this.constructs.kind !== 'Undefined') {
          code += ': ' + (this.constructs.toFeatherString() || 'Unknown');
        } else if (this.returns && this.returns.kind !== 'Undefined') {
          code += ': ' + (this.returns?.toFeatherString() || 'Unknown');
        }
        break;
      default:
        code = this.toFeatherString();
        break;
    }
    return code;
  }

  get canHaveMembers() {
    return ['Struct', 'Enum'].includes(this.kind);
  }

  get canHaveItems() {
    return (
      ['Array', 'Struct'].includes(this.kind) || this.kind.startsWith('Id.Ds')
    );
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

  getParameter(name: string): TypeMember | undefined;
  getParameter(idx: number): TypeMember | undefined;
  getParameter(nameOrIdx: string | number): TypeMember | undefined {
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
    this.params ??= [];
    let param = this.params[idx];
    if (!param) {
      param = new TypeMember(this, name, type);
      param.writable = false;
      this.params[idx] = param;
    }
    param.type = type;
    param.optional = optional;
    param.name = name;
    param.idx = idx;
    param.parameter = true;
    return param;
  }

  getMember(name: string): TypeMember | undefined {
    return this.members?.find((m) => m.name === name);
  }

  /** For container types that have named members, like Structs and Enums */
  addMember(name: string, type: Type, writable = true): TypeMember {
    ok(
      this.canHaveMembers,
      `Cannot add member to non-struct/enum type ${this.kind}`,
    );
    this.members ??= [];
    let member = this.members.find((m) => m.name === name);
    if (!member) {
      member = new TypeMember(this, name, type);
      member.writable = writable;
      this.members.push(member);
    } else {
      if (member.type.kind !== 'Union') {
        const oldType = member.type;
        member.type = new Type('Union').addUnionType(oldType);
      }
      member.type.addUnionType(type);
    }
    return member;
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
    ok(this.canHaveItems, `Cannot add item to non-array type ${this.kind}`);
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

  named(name: string): this {
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
   * If it is not a union, convert it to a union and add the
   * provided Type to the union.
   *
   * In all cases the original instance is mutated unless it was undefined.
   */
  static merge(original: Type | undefined, withType: Type): Type {
    // If the incoming type is unknown, toss it.
    // If the original type is Any/Mixed, then it's already as wide as possible so don't change it.
    if (!original) {
      return withType;
    }
    if (
      withType.kind === 'Unknown' ||
      ['Any', 'Mixed'].includes(original.kind)
    ) {
      return original;
    }
    // If the original type is unknow, now we know it! So just replace it.
    if (original.kind === 'Unknown') {
      // Then change it to the provided type
      Object.assign(original, withType);
      return original as any;
    }
    // Otherwise we're going to add a type to a union. If we aren't a union, convert to one.
    if (original.kind !== 'Union') {
      // Get a copy of the current type to add to the new union
      const preUnionType = structuredClone(original);
      // Then convert it to a union
      const unionType = new Type('Union');
      Object.assign(original, unionType);
      // Then add the previous type to the union
      original.types = [preUnionType];
    }
    // Add the new type to the union
    original.types ??= [];
    original.types.push(withType);
    return original;
  }

  /** Given a Feather-compatible type string, get a fully parsed type. */
  static from(typeString: string, knownTypes: Map<string, Type>): Type {
    const parsed = parser.parseTypeString(typeString);
    return Type.fromCst(parsed.cst, knownTypes);
  }

  static fromCst(
    node: JsdocTypeUnionCstNode | JsdocTypeCstNode,
    knownTypes: Map<string, Type>,
  ): Type {
    if (node.name === 'jsdocType') {
      const identifier = node.children.JsdocIdentifier[0].image;
      let type = Type.fromIdentifier(identifier, knownTypes);
      const subtypeNode = node.children.jsdocTypeUnion?.[0];
      if (subtypeNode) {
        const subtype = Type.fromCst(subtypeNode, knownTypes);
        // Then we need to create a new type instead of mutating
        // the one we found.
        type = type.derive();
        if (type.kind.match(/^(Array|Struct|Id.Ds)/)) {
          type.addItemType(subtype);
        }
        // TODO: Else create a diagnostic?
      }
      return type;
    } else if (node.name === 'jsdocTypeUnion') {
      const unionOf = node.children.jsdocType;
      if (unionOf.length === 1) {
        return Type.fromCst(unionOf[0], knownTypes);
      }
      const type = new Type('Union');
      for (const child of unionOf) {
        const subtype = Type.fromCst(child, knownTypes);
        type.addUnionType(subtype);
      }
      return type;
    }
    throw new Error(`Unknown node type ${node['name']}`);
  }

  /**
   * Given a type identifier, get a parsed Type instance. Useful for
   * the "leaves" of a type tree, e.g. "String" or "Struct.Mystruct".
   * Only creates primitive types, e.g. "Struct.MyStruct" will return
   * a plain `Type<"Struct">` instance.
   *
   * When knownTypes are provided, will return a known type by exact
   * identifier match if it exists. Otherwise a new type instance will
   * be created *and added to the knownTypes map*.
   */
  static fromIdentifier(
    identifier: string,
    knownTypes: Map<string, Type>,
    __isRootRequest = true,
  ): Type {
    ok(
      identifier.match(/^[A-Z][A-Z0-9.]*$/i),
      `Invalid type name ${identifier}`,
    );
    const knownType = knownTypes.get(identifier);
    if (knownType) {
      return knownType;
    }
    const normalizedName = identifier.toLocaleLowerCase();
    const primitiveType = primitiveNames.find(
      (n) => n.toLocaleLowerCase() === normalizedName,
    );
    if (primitiveType) {
      return new Type(primitiveType);
    } else if (identifier.match(/\./)) {
      // Then we might still be able to get a base type.
      const [baseType, ...nameParts] = identifier.split('.');
      const type = Type.fromIdentifier(baseType, knownTypes, false);
      if (__isRootRequest && type) {
        // Then add to the known types map
        const derivedTyped = type.derive().named(nameParts.join('.'));
        knownTypes.set(identifier, derivedTyped);
        return derivedTyped;
      }
      return type;
    }
    return new Type('Unknown');
  }

  toJSON() {
    return {
      $tag: this.$tag,
      kind: this.kind,
      parent: this.parent,
      members: this.members,
      items: this.items,
      types: this.types,
      context: this.context,
      params: this.params,
      returns: this.returns,
    };
  }
}
