import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { JsdocTypeCstNode, JsdocTypeUnionCstNode } from '../gml-cst.js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './gml.schema.js';
import { parser } from './parser.js';
import * as t from './project.abstract.js';

export class Flaggable {
  flags: t.SymbolFlag = t.SymbolFlag.ReadWrite;

  canWrite() {
    return !!(this.flags & t.SymbolFlag.Writable);
  }

  canRead() {
    return !!(this.flags & t.SymbolFlag.Readable);
  }

  /** Set the Writeable flag to false */
  writable(writable: boolean): this {
    if (writable) {
      this.flags |= t.SymbolFlag.Writable;
    } else {
      this.flags &= ~t.SymbolFlag.Writable;
    }
    return this;
  }
}

export class ProjectTypes {
  protected spec!: GmlSpec;
  readonly symbols: Map<string, Symbol> = new Map();
  /**
   * Types, looked up by their Feather-compatible name.
   * Types can be either a single type or a type union.
   */
  readonly types: Map<string, Type> = new Map();

  protected constructor(readonly filePath: string) {
    // Initialize all of the primitives so we can guarantee
    // they exist on any lookup.
    primitiveNames.forEach((name) => {
      this.types.set(name, new Type(name));
    });
  }

  get version() {
    return this.spec.runtime;
  }

  createStructType(): StructType {
    return this.types.get('Struct')!.derive() as StructType;
  }

  createRealType(): RealType {
    return this.types.get('Real')!.derive() as RealType;
  }

  createStringType(): StringType {
    return this.types.get('String')!.derive() as StringType;
  }

  protected load() {
    // Create struct types. Each one extends the base Struct type.
    for (const struct of this.spec.structures) {
      if (!struct.name) {
        console.warn(`Skipping unnamed struct`);
        continue;
      }
      const typeName = `Struct.${struct.name}`;
      const structType =
        this.types.get(typeName) || this.createStructType().named(struct.name);
      ok(!structType.members?.length, `Type ${typeName} already exists`);
      this.types.set(typeName, structType);

      for (const prop of struct.properties) {
        if (prop.type.length === 1) {
          structType.addMemberType(
            prop.name,
            Type.from(prop.type[0], this.types).named(prop.name),
            prop.writable,
          );
          continue;
        }
        const propType = new Type('Union').named(prop.name);
        for (const typeString of prop.type) {
          const type = Type.from(typeString, this.types);
          propType.addUnionType(type);
        }
        structType.addMemberType(prop.name, propType, prop.writable);
      }
    }

    // Handle the constants.
    // Each constant value represents a unique expression
    // of its type (e.g. it's not just a Real, it's the Real
    // value 7 or whatever). Unlike the structs section of
    // the spec, which are *only* used for types, constants
    // are referenceabled in the code. Therefore we need
    // a unique symbol and type for each constant value,
    // along with a type that collects all of those types.

    // First group them all by "class". The empty-string
    // class represents the absence of a class.
    const constantsByClass = new Map<string, GmlSpecConstant[]>();
    for (const constant of this.spec.constants) {
      const klass = constant.class || '';
      constantsByClass.set(klass, constantsByClass.get(klass) || []);
      constantsByClass.get(klass)!.push(constant);
    }
    // Then create a type for each class and a symbol for each constant.
    for (const [klass, constants] of constantsByClass) {
      // if (!klass) {
      //   // TODO: Figure out what to do with these.
      //   continue;
      // }
      // // Do all members have the same type?
      // const typeNames = new Set(constants.map((c) => c.type));
      // if (typeNames.size > 1) {
      //   console.log(
      //     `Skipping class ${klass} with multiple types: ${stringify(
      //       typeNames,
      //     )}`,
      //   );
      //   continue;
      // }
      // // Create a union type for the class
      // const classTypeName = `Class.${klass}`;
      // const classType = this.ensureType(classTypeName);
      // // Iterate over all constants in the class.
      // for (const constant of constants) {
      //   // Create an extended type
      //   const baseType = this.primitives[constant.type as PrimitiveName];
      //   if (!baseType) {
      //     // TODO: Handle this.
      //     console.log(
      //       `Skipping constant ${constant.name} of unknown type`,
      //       constant.type,
      //     );
      //     continue;
      //   }
      //   const constantType = baseType.derive();
      //   // Add the constantType to the class union
      //   classType.add(constantType);
      //   // Create the symbol
      //   const symbol = new Symbol(constant.name)
      //     .writable(false)
      //     .addType(constantType);
      //   // These symbols are constants, so flag their type as immutable.
      //   symbol.type.mutable = false;
      //   // Add the symbol to the global symbol table
      //   ok(
      //     !this.symbols.has(symbol.name),
      //     `Symbol ${symbol.name} already exists`,
      //   );
      //   this.symbols.set(symbol.name, symbol);
      // }
    }
    for (const func of this.spec.functions) {
    }
    for (const variable of this.spec.variables) {
    }
  }

  static async from(
    filePath: string = ProjectTypes.fallbackGmlSpecPath.absolute,
  ) {
    const parsedSpec = await ProjectTypes.parse(filePath);
    const spec = new ProjectTypes(filePath);
    spec.spec = parsedSpec;
    spec.load();
    return spec;
  }

  static async parse(specFilePath: string): Promise<GmlSpec> {
    const specRaw = await readFile(specFilePath, 'utf8');
    const asJson = await parseStringPromise(specRaw.replace('\ufeff', ''), {
      trim: true,
      normalize: true,
    }); // Prevent possible errors: "Non-white space before first tag"
    return gmlSpecSchema.parse(asJson);
  }

  toJSON() {
    return {
      filePath: this.filePath,
      symbols: this.symbols,
      types: this.types,
    };
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}

export class Symbol extends Flaggable {
  readonly $tag = 'Sym';
  refs: t.Reference[] = [];
  description: string | undefined = undefined;
  range: t.Range | undefined = undefined;
  type: Type = new Type('Unknown');

  constructor(readonly name: string) {
    super();
  }

  toJSON() {
    return {
      $tag: this.$tag,
      name: this.name,
      type: this.type,
    };
  }

  addRef(location: t.Range, type: Type): void {
    throw new Error('Method not implemented.');
  }

  addType(type: Type): this {
    // We may have duplicate types, but that information is
    // still useful since the same type information may have
    // come from multiple assignment statements.
    if (this.type.kind === 'Unknown') {
      // Change the type to a this new type
      this.type = type;
    } else if (this.type.kind !== 'Union') {
      // Then we need to convert it into a union type
      const unionType = new Type('Union');
    }
    return this;
  }
}

export class Reference {
  readonly $tag = 'Ref';
  type: Type = new Type('Unknown');
  start: t.Position;
  end: t.Position;
  constructor(readonly symbol: t.Symbol, readonly location: t.Range) {
    this.start = location.start;
    this.end = location.end;
  }
}

export type PrimitiveName = (typeof primitiveNames)[number];
export const primitiveNames = [
  'Any',
  'Array',
  'Asset.GMAnimCurve',
  'Asset.GMAudioGroup',
  'Asset.GMFont',
  'Asset.GMObject',
  'Asset.GMParticleSystem',
  'Asset.GMPath',
  'Asset.GMRoom',
  'Asset.GMScript',
  'Asset.GMSequence',
  'Asset.GMShader',
  'Asset.GMSound',
  'Asset.GMSprite',
  'Asset.GMTileSet',
  'Asset.GMTimeline',
  'Asset.Script',
  'Bool',
  'Enum',
  'Function',
  'Id.AudioEmitter',
  'Id.AudioListener',
  'Id.AudioSyncGroup',
  'Id.BackgroundElement',
  'Id.BinaryFile',
  'Id.Buffer',
  'Id.Camera',
  'Id.DsGrid',
  'Id.DsList',
  'Id.DsMap',
  'Id.DsPriority',
  'Id.DsQueue',
  'Id.DsStack',
  'Id.ExternalCall',
  'Id.Gif',
  'Id.Instance',
  'Id.Layer',
  'Id.MpGrid',
  'Id.ParticleEmitter',
  'Id.ParticleSystem',
  'Id.ParticleType',
  'Id.PhysicsIndex',
  'Id.PhysicsParticleGroup',
  'Id.Sampler',
  'Id.SequenceElement',
  'Id.Socket',
  'Id.Sound',
  'Id.SpriteElement',
  'Id.Surface',
  'Id.TextFile',
  'Id.Texture',
  'Id.TileElementId',
  'Id.TileMapElement',
  'Id.TimeSource',
  'Id.Uniform',
  'Id.VertexBuffer',
  'Id.VertexFormat',
  'Mixed',
  'Pointer',
  'Real',
  'String',
  'Struct',
  'Undefined',
  'Union',
  'Unknown',
] as const;
Object.freeze(Object.seal(primitiveNames));

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

export class TypeMember extends Flaggable {
  constructor(public name: string, public type: Type) {
    super();
  }
}

export class Type<T extends PrimitiveName = PrimitiveName> {
  readonly $tag = 'Type';
  // Some types have names. It only counts as a name if it
  // cannot be parsed into types given the name alone.
  // E.g. `Array<String>` is not a name, but `Struct.MyStruct`
  // results in the name `MyStruct`.
  name: string | undefined = undefined;
  /**
   * If set, then this Type is treated as a subset of the parent.
   * It will only "match" another type if that type is in its
   * parent somewhere. Useful for struct inheritence, as well
   * as for e.g. representing a subset of Real constants in a type. */
  parent: Type<T> | undefined = undefined;

  def: t.Reference | undefined = undefined;
  refs: t.Reference[] = [];
  // Applicable to Structs and Enums
  members: TypeMember[] | undefined = undefined;
  // Applicable to Arrays
  items: Type | undefined = undefined;
  // Applicable to Unions
  types: Type[] | undefined = undefined;
  // Applicable to Functions
  context: Type<'String'> | undefined = undefined;
  params: undefined | { name: string; type: Type; optional: boolean }[] =
    undefined;
  returns: undefined | Type = undefined;

  constructor(readonly kind: T) {}

  getMember(name: string): TypeMember | undefined {
    return this.members?.find((m) => m.name === name);
  }

  get canHaveMembers() {
    return ['Struct', 'Enum'].includes(this.kind);
  }

  get canHaveItems() {
    return (
      ['Array', 'Struct'].includes(this.kind) || this.kind.startsWith('Id.Ds')
    );
  }

  /** For container types that have named members, like Structs and Enums */
  addMemberType(name: string, type: Type, writable = true): this {
    ok(
      this.canHaveMembers,
      `Cannot add member to non-struct/enum type ${this.kind}`,
    );
    this.members ??= [];
    let member = this.members.find((m) => m.name === name);
    if (!member) {
      member = new TypeMember(name, type).writable(writable);
      this.members.push(member);
    } else {
      if (member.type.kind !== 'Union') {
        const oldType = member.type;
        member.type = new Type('Union').addUnionType(oldType);
      }
      member.type.addUnionType(type);
    }
    return this;
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
    const derived = new Type(this.kind);
    derived.parent = this;
    return derived;
  }

  named(name: string): this {
    this.name = name;
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
  static merge(original: Type | undefined, type: Type): Type {
    // If the incoming type is unknown, toss it.
    // If the original type is Any/Mixed, then it's already as wide as possible so don't change it.
    if (!original) {
      return type;
    }
    if (type.kind === 'Unknown' || ['Any', 'Mixed'].includes(original.kind)) {
      return original;
    }
    // If the original type is unknow, now we know it! So just replace it.
    if (original.kind === 'Unknown') {
      // Then change it to the provided type
      Object.assign(original, type);
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
    original.types.push(type);
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
      const type = Type.fromIdentifier(identifier, knownTypes);
      const subtypeNode = node.children.jsdocTypeUnion?.[0];
      if (subtypeNode) {
        const subtype = Type.fromCst(subtypeNode, knownTypes);
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
