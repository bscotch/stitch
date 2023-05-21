import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { GmlSpec, gmlSpecSchema } from './gml.schema.js';
import * as t from './project.abstract.js';
import { stringify } from './util.js';

export class Gml {
  protected spec!: GmlSpec;
  readonly symbols: Map<string, Symbol> = new Map();
  readonly functions: Symbol[] = [];
  readonly variables: Symbol[] = [];
  readonly constants: Symbol[] = [];
  /** Types, looked up by their Feather-compatible name. */
  readonly types: Map<string, TypeUnion> = new Map();

  protected constructor(readonly filePath: string) {
    // Add base types.
    const anyType = new AnyType();
    this.ensureType('Any', anyType);
    this.ensureType('Real', new RealType());
    this.ensureType('String', new StringType());
    this.ensureType('Bool', new BoolType());
    this.ensureType('Undefined', new UndefinedType());
    this.ensureType('Pointer', new PointerType());
    this.ensureType('Array', new ArrayType());
    this.ensureType('Function', new FunctionType());
    this.ensureType('Enum', new EnumType());
    this.ensureType('Struct', new StructType());
    this.ensureType('Mixed', anyType);

    // Add wonky built-in root "types"
    this.ensureType('Constant', anyType);
    this.ensureType('Asset', anyType);
    this.ensureType('Id', anyType);
  }

  ensureType(name: string, type?: Type | TypeUnion): TypeUnion {
    const existing = this.types.get(name);
    if (existing) {
      return existing;
    }
    const baseName = name.replace(/\.[^.]+$/, '');
    let parent: null | TypeUnion = null;
    if (baseName !== name) {
      parent = this.ensureType(baseName);
    }
    type = type
      ? type.$tag === t.TagKind.Type
        ? new TypeUnion().add(type)
        : type
      : new TypeUnion();
    type.parent = parent;
    this.types.set(name, type.named(name));
    return type;
  }

  updateNamedType(name: string, type: Type) {
    const existing = this.types.get(name);
    ok(existing, `Could not find type ${name}`);
    existing.add(type);
    return this;
  }

  get version() {
    return this.spec.runtime;
  }

  protected load() {
    for (const name of this.spec.types) {
      console.log(name);
    }
    // Create struct types
    for (const struct of this.spec.structures) {
      if (!struct.name) {
        console.warn(`Skipping unnamed struct`);
        continue;
      }
      const typeName = `Struct.${struct.name}`;
      const namedType = this.types.get('Struct')!.extend().named(typeName);
      const structType = new StructType();
      this.types.set(typeName, namedType);
      namedType.add(structType);

      for (const prop of struct.properties) {
        const propType = this.ensureType(prop.type);
        structType.addMember(prop.name, propType);
      }
    }

    for (const constant of this.spec.constants) {
      let typeName = constant.type;
      if (constant.class) {
        typeName = `Constant.${constant.class}`;
      }
      // const type = this.ensureType(constant.type);
      // const namedType = this.ensureType(typeName);
      // namedType.add(type);

      // let type = this.types.get(typeName);
      // const baseType = this.types.get(constant.type);
      // ok(baseType, `Could not find base type ${constant.type}`);
      // if (!type) {
      //   type = baseType.extend().named(typeName);
      //   this.types.set(typeName, type);
      // }
      // ok(
      //   type.extends(baseType!),
      //   `Type ${typeName} does not extend ${constant.type}`,
      // );
    }
    for (const func of this.spec.functions) {
    }
    for (const variable of this.spec.variables) {
    }
    writeFileSync('gml.json', stringify(this));
  }

  static async from(filePath: string = Gml.fallbackGmlSpecPath.absolute) {
    const parsedSpec = await Gml.parse(filePath);
    const spec = new Gml(filePath);
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
      functions: this.functions,
      variables: this.variables,
      constants: this.constants,
      types: this.types,
    };
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}

export class Symbol {
  readonly $tag = t.TagKind.Symbol;
  refs: t.Reference[] = [];
  description: string | null = null;
  flags: t.SymbolFlag = t.SymbolFlag.ReadWrite;
  range: t.Range | null = null;
  type = new TypeUnion();

  constructor(readonly parent: t.StructType, readonly name: string) {}

  addRef(location: t.Range, type: TypeUnion): void {
    throw new Error('Method not implemented.');
  }

  addType(type: Type) {
    // We may have duplicate types, but that information is
    // still useful since the same type information may have
    // come from multiple assignment statements.
    this.type.add(type);
  }
}

export class Reference {
  readonly $tag = t.TagKind.Reference;
  type = new TypeUnion();
  start: t.Position;
  end: t.Position;
  constructor(readonly symbol: t.Symbol, readonly location: t.Range) {
    this.start = location.start;
    this.end = location.end;
  }
}

export class TypeUnion {
  readonly $tag = t.TagKind.TypeUnion;
  mutable = true;
  parent: TypeUnion | null = null;
  protected _types: Type[] = [];
  /**
   * Feather-compatible name of this type, if present.
   */
  name: string | null = null;

  get types(): Type[] {
    return [...this._types];
  }

  named(name: string): this {
    this.name = name;
    return this;
  }

  add(type: Type): this {
    ok(this.mutable, 'Cannot add type to immutable TypeUnion');
    this._types.push(type);
    return this;
  }

  /** Create a new TypeUnion using this one as the parent */
  extend(): TypeUnion {
    const union = new TypeUnion();
    union.parent = this;
    return union;
  }

  /** Check if a type union extends another type (i.e. it has the other TypeUnion in its ancestors) */
  extends(other: TypeUnion): boolean {
    let parent: TypeUnion | null = this;
    while (parent) {
      if (parent === other) return true;
      parent = parent.parent;
    }
    return false;
  }

  toJSON() {
    return {
      $tag: this.$tag,
      name: this.name,
      types: this._types,
    };
  }
}

export type Type =
  | AnyType
  | ArrayType
  | StructType
  | FunctionType
  | EnumType
  | StringType
  | RealType
  | BoolType
  | PointerType
  | UndefinedType;

abstract class TypeBase<T extends t.PrimitiveKind> {
  def: t.Reference | null = null;
  refs: t.Reference[] = [];
  parent: Type | null = null;
  readonly $tag = t.TagKind.Type;

  constructor(readonly kind: T) {}

  toJSON() {
    return {
      $tag: this.$tag,
      kind: this.kind,
    };
  }
}

export class AnyType extends TypeBase<t.PrimitiveKind.Any> {
  override readonly kind = t.PrimitiveKind.Any;
  constructor() {
    super(t.PrimitiveKind.Any);
  }
}

export class RealType extends TypeBase<t.PrimitiveKind.Real> {
  override readonly kind = t.PrimitiveKind.Real;
  constructor() {
    super(t.PrimitiveKind.Real);
  }
}

export class BoolType extends TypeBase<t.PrimitiveKind.Bool> {
  override readonly kind = t.PrimitiveKind.Bool;
  constructor() {
    super(t.PrimitiveKind.Bool);
  }
}

export class StringType extends TypeBase<t.PrimitiveKind.String> {
  override readonly kind = t.PrimitiveKind.String;
  constructor() {
    super(t.PrimitiveKind.String);
  }
}

export class PointerType extends TypeBase<t.PrimitiveKind.Pointer> {
  override readonly kind = t.PrimitiveKind.Pointer;
  constructor() {
    super(t.PrimitiveKind.Pointer);
  }
}

export class UndefinedType extends TypeBase<t.PrimitiveKind.Undefined> {
  override readonly kind = t.PrimitiveKind.Undefined;
  constructor() {
    super(t.PrimitiveKind.Undefined);
  }
}

export class FunctionType extends TypeBase<t.PrimitiveKind.Function> {
  override readonly kind = t.PrimitiveKind.Function;
  context!: StructType;
  params: { name: string; type: TypeUnion; optional: boolean }[] = [];
  returns = new TypeUnion();
  constructor() {
    super(t.PrimitiveKind.Function);
  }
  override toJSON() {
    return {
      ...super.toJSON(),
      context: this.context,
      params: this.params,
      returns: this.returns,
    };
  }
}

export class EnumType extends TypeBase<t.PrimitiveKind.Enum> {
  override readonly kind = t.PrimitiveKind.Enum;
  members = {};
  constructor() {
    super(t.PrimitiveKind.Enum);
  }
  override toJSON() {
    return {
      ...super.toJSON(),
      members: this.members,
    };
  }
}

export class StructType extends TypeBase<t.PrimitiveKind.Struct> {
  override readonly kind = t.PrimitiveKind.Struct;
  members: { [name: string]: TypeUnion } = {};
  constructor() {
    super(t.PrimitiveKind.Struct);
  }

  addMember(name: string, type: TypeUnion) {
    this.members[name] = type;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      members: this.members,
    };
  }
}

export class ArrayType extends TypeBase<t.PrimitiveKind.Array> {
  override readonly kind = t.PrimitiveKind.Array;
  members = new TypeUnion();
  constructor() {
    super(t.PrimitiveKind.Array);
  }
  override toJSON() {
    return {
      ...super.toJSON(),
      members: this.members,
    };
  }
}
