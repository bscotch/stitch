import type { JsdocSummary } from './jsdoc.js';
import {
  parseFeatherTypeString,
  type FeatherType,
  type FeatherTypeUnion,
} from './jsdoc.typestring.js';
import { Flaggable } from './project.flags.js';
import { Refs } from './project.location.js';
import { PrimitiveName, primitiveNames } from './project.primitives.js';
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

export function typeIs<T extends PrimitiveName>(
  item: any,
  kind: T,
): item is Type<T> {
  return isType(item) && item.kind === kind;
}

export function isType(item: any): item is Type {
  return item instanceof Type;
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
  protected members: TypeMember[] | undefined = undefined;

  // Applicable to Arrays
  items: Type | undefined = undefined;

  // Applicable to Unions
  types: Type[] | undefined = undefined;

  // Applicable to Functions
  /**
   * If this is a constructor function, then this is the
   * type of the struct that it constructs. */
  constructs: Type<'Struct'> | undefined = undefined;
  context: Type<'Struct'> | undefined = undefined;
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
          assert(param, 'Param is undefined');
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
      this.params[idx] = param;
    }
    param.type = type;
    param.optional = optional || name === '...';
    param.name = name;
    param.idx = idx;
    param.parameter = true;
    param.local = true;
    return param;
  }

  listMembers(excludeParents = false): TypeMember[] {
    const members = this.members || [];
    if (excludeParents || !this.parent) {
      return members;
    }
    return [...members, ...this.parent.listMembers()];
  }

  getMember(name: string): TypeMember | undefined {
    return (
      this.members?.find((m) => m.name === name) || this.parent?.getMember(name)
    );
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
  static fromFeatherString(
    typeString: string,
    knownTypes: Map<string, Type>,
  ): Type {
    const parsed = parseFeatherTypeString(typeString);
    return Type.fromParsedFeatherString(parsed, knownTypes);
  }

  static fromParsedFeatherString(
    node: FeatherTypeUnion | FeatherType,
    knownTypes: Map<string, Type>,
  ): Type {
    if (node.kind === 'type') {
      const identifier = node.name;
      let type = Type.fromIdentifier(identifier, knownTypes);
      if (node.of) {
        const subtype = Type.fromParsedFeatherString(node.of, knownTypes);
        // Then we need to create a new type instead of mutating
        // the one we found.
        type = type.derive();
        if (type.kind.match(/^(Array|Struct|Id.Ds)/)) {
          type.addItemType(subtype);
        }
        // TODO: Else create a diagnostic?
      }
      return type;
    } else if (node.kind === 'union') {
      const unionOf = node.types;
      if (unionOf.length === 1) {
        return Type.fromParsedFeatherString(unionOf[0], knownTypes);
      }
      const type = new Type('Union');
      for (const child of unionOf) {
        const subtype = Type.fromParsedFeatherString(child, knownTypes);
        type.addUnionType(subtype);
      }
      return type;
    }
    throw new Error(`Unknown node type ${node['name']}`);
  }

  static fromParsedJsdocs(
    jsdoc: JsdocSummary,
    knownTypes: Map<string, Type>,
  ): Type {
    if (jsdoc.kind === 'description') {
      // Then we have no type info but have a description to add.
      return Type.fromIdentifier('Unknown', knownTypes).describe(
        jsdoc.description,
      );
    } else if (jsdoc.kind === 'type') {
      // Then this was purely a type annotation. Create the type and
      // add any metadata.
      return Type.fromFeatherString(jsdoc.type!.content, knownTypes).describe(
        jsdoc.description,
      );
    } else if (jsdoc.kind === 'self') {
      return Type.fromFeatherString(jsdoc.self!.content, knownTypes).describe(
        jsdoc.description,
      );
    } else if (jsdoc.kind === 'function') {
      const type = Type.fromIdentifier('Function', knownTypes).describe(
        jsdoc.description,
      );
      let i = 0;
      if (jsdoc.deprecated) {
        type.deprecated = true;
      }
      if (jsdoc.self) {
        type.context = Type.fromFeatherString(
          jsdoc.self!.content,
          knownTypes,
        ) as Type<any>;
      }
      if (jsdoc.returns) {
        const returnType = Type.fromFeatherString(
          jsdoc.returns.type!.content,
          knownTypes,
        ).describe(jsdoc.returns.description);
        type.addReturnType(returnType);
      }
      for (const param of jsdoc.params || []) {
        if (!param.type?.content) {
          console.log(jsdoc);
        }
        const paramType = Type.fromFeatherString(
          param.type!.content,
          knownTypes,
        )
          .named(param.name!.content)
          .describe(param.description);
        const member = type.addParameter(i, param.name!.content, paramType);
        i++;
        member.optional = param.optional;
        member.describe(param.description);
      }
      return type;
    }
    throw new Error(`Unknown JSDoc kind ${jsdoc.kind}`);
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
      identifier.match(/^[A-Z][A-Z0-9._]*$/i),
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
