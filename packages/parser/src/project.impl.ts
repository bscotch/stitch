import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './gml.schema.js';
import * as t from './project.abstract.js';
import { stringify } from './util.js';

export class ProjectTypes {
  protected spec!: GmlSpec;
  readonly symbols: Map<string, Symbol> = new Map();
  readonly functions: Symbol[] = [];
  readonly variables: Symbol[] = [];
  readonly constants: Symbol[] = [];
  /**
   * Types, looked up by their Feather-compatible name.
   * Types can be either a single type or a type union.
   */
  readonly types: Map<string, TypeUnion> = new Map();
  readonly primitives = primitiveNames.reduce((acc, name) => {
    // @ts-expect-error
    acc[name] = new Type(name);
    return acc;
  }, {} as { [P in PrimitiveName]: Type<P> });

  protected constructor(readonly filePath: string) {}

  get version() {
    return this.spec.runtime;
  }

  deriveStruct(): StructType {
    return this.primitives.Struct.derive();
  }

  ensureType(name: string, type?: Type | Type[]): TypeUnion {
    let union = this.types.get(name);
    if (!union) {
      union = new TypeUnion();
      this.types.set(name, union);
    }
    const types = Array.isArray(type) ? type : [type];
    for (type of types) {
      if (type) {
        union.add(type);
      }
    }
    return union;
  }

  protected load() {
    for (const name of this.spec.types) {
      console.log(name);
    }

    // Create struct types. Each one extends the base Struct type.
    for (const struct of this.spec.structures) {
      if (!struct.name) {
        console.warn(`Skipping unnamed struct`);
        continue;
      }
      const typeName = `Struct.${struct.name}`;
      const structType = this.deriveStruct();
      ok(!this.types.has(typeName), `Type ${typeName} already exists`);
      this.ensureType(typeName, structType);

      for (const prop of struct.properties) {
        let propType: TypeUnion;
        if (prop.type in this.primitives) {
          propType = new TypeUnion().add(
            this.primitives[prop.type as PrimitiveName],
          );
        } else {
          propType = this.ensureType(prop.type);
        }
        ok(propType instanceof TypeUnion, `Type ${prop.type} is not a union`);
        structType.addMember(prop.name, propType);
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
      if (!klass) {
        // TODO: Figure out what to do with these.
        continue;
      }
      // TODO: Create a union type for the class
      // TODO: Iterate over all constants in the class.
      // TODO: For each, create an extended type and a symbol, and ensure that the type is in the union.

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
  readonly $tag = 'Sym';
  refs: t.Reference[] = [];
  description: string | undefined = undefined;
  flags: t.SymbolFlag = t.SymbolFlag.ReadWrite;
  range: t.Range | undefined = undefined;
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
  readonly $tag = 'Ref';
  type = new TypeUnion();
  start: t.Position;
  end: t.Position;
  constructor(readonly symbol: t.Symbol, readonly location: t.Range) {
    this.start = location.start;
    this.end = location.end;
  }
}

export class TypeUnion {
  readonly $tag = 'Union';
  mutable = true;
  protected _types: Type[] = [];
  /**
   * Feather-compatible name of this type, if present.
   */
  name: string | undefined = undefined;

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

  toJSON() {
    return {
      $tag: this.$tag,
      name: this.name,
      types: this._types,
    };
  }
}

export type PrimitiveName = (typeof primitiveNames)[number];
export const primitiveNames = [
  'Any',
  'Array',
  'Bool',
  'Enum',
  'Function',
  'Mixed',
  'Pointer',
  'Real',
  'String',
  'Struct',
  'Undefined',
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

export class Type<T extends PrimitiveName = PrimitiveName> {
  /** The tag for this object, the same for all Type instances */
  readonly $tag = 'Type';
  /**
   * If set, then this Type is treated as a subset of the parent.
   * It will only "match" another type if that type is in its
   * parent somewhere. Useful for struct inheritence, as well
   * as for e.g. representing a subset of Real constants in a type. */
  parent: Type<T> | undefined = undefined;

  def: t.Reference | undefined = undefined;
  refs: t.Reference[] = [];
  // Applicable to Structs and Enums
  members: Record<string, TypeUnion> | undefined = undefined;
  // Applicable to Arrays
  items: TypeUnion | undefined = undefined;
  // Applicable to Functions
  context: Type<'String'> | undefined = undefined;
  params: undefined | { name: string; type: TypeUnion; optional: boolean }[] =
    undefined;
  returns: undefined | TypeUnion = undefined;

  constructor(readonly kind: T) {}

  addMember(name: string, type: TypeUnion) {
    ok(
      ['Struct', 'Enum'].includes(this.kind),
      `Cannot add member to non-struct/enum type ${this.kind}`,
    );
    this.members ??= {};
    this.members[name] = type;
  }

  /**
   * Create a derived type: of the same kind, pointing to
   * this type as its parent. */
  derive(): Type<T> {
    const derived = new Type(this.kind);
    derived.parent = this;
    return derived;
  }

  toJSON() {
    return {
      $tag: this.$tag,
      kind: this.kind,
      parent: this.parent,
      members: this.members,
      items: this.items,
      context: this.context,
      params: this.params,
      returns: this.returns,
    };
  }
}
