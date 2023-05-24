import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './gml.schema.js';
import * as t from './project.abstract.js';
import { Flaggable } from './types.flags.js';
import { primitiveNames } from './types.primitives.js';
import { StructType, Type } from './types.type.js';

export class GmlTypes {
  protected spec!: GmlSpec;
  /** Symbols available globally */
  readonly global: Map<string, Symbol> = new Map();
  /** Symbols available in object instance scopes */
  readonly instance: Map<string, Symbol> = new Map();

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
  protected load() {
    this.loadConstants();
    this.loadVariables();
    this.loadStructs();
    this.loadFunctions();
  }

  protected loadVariables() {
    for (const variable of this.spec.variables) {
      const symbol = new Symbol(variable.name)
        .writable(variable.writable)
        .describe(variable.description)
        .deprecate(variable.deprecated)
        .addType(Type.from(variable.type, this.types));
      if (variable.instance) {
        this.instance.set(symbol.name, symbol);
      } else {
        this.global.set(symbol.name, symbol);
      }
    }
  }

  protected loadFunctions() {
    for (const func of this.spec.functions) {
    }
  }

  protected loadConstants() {
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
        for (const constant of constants) {
          const symbol = new Symbol(constant.name)
            .writable(false)
            .describe(constant.description)
            .addType(Type.from(constant.type, this.types));
          this.global.set(symbol.name, symbol);
        }
        continue;
      }

      // Figure out what types are in use by this class.
      const typeNames = new Set<string>();
      for (const constant of constants) {
        typeNames.add(constant.type);
      }
      ok(typeNames.size, `Class ${klass} has no types`);

      // Create the base type for the class.
      const classTypeName = `Constant.${klass}`;
      const typeString = [...typeNames.values()].join('|');
      let classType = Type.from(typeString, this.types)
        .derive()
        .named(classTypeName);
      const existingType = this.types.get(classTypeName);
      if (existingType) {
        // Then we defined an Unknown type earlier to handle a reference.
        // Replace it with the real type.!;
        ok(
          existingType.kind === 'Unknown',
          `Type ${classTypeName} already exists but is not Unknown`,
        );
        classType = Type.merge(existingType, classType);
      } else {
        this.types.set(classTypeName, classType);
      }
      // Create symbols for each class member.
      for (const constant of constants) {
        const symbol = new Symbol(constant.name)
          .writable(false)
          .describe(constant.description);
        symbol.addType(classType);
        this.global.set(symbol.name, symbol);
      }
    }
  }

  protected loadStructs() {
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
        const type = Type.from(prop.type, this.types);
        structType.addMemberType(prop.name, type, prop.writable);
      }
    }
  }

  static async from(filePath: string = GmlTypes.fallbackGmlSpecPath.absolute) {
    const parsedSpec = await GmlTypes.parse(filePath);
    const spec = new GmlTypes(filePath);
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
      symbols: this.global,
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

  describe(description: string | undefined): this {
    this.description = description;
    return this;
  }

  addRef(location: t.Range, type: t.Type): void {
    throw new Error('Method not implemented.');
  }

  addType(newType: Type): this {
    // We may have duplicate types, but that information is
    // still useful since the same type information may have
    // come from multiple assignment statements.
    if (this.type.kind === 'Unknown') {
      // Change the type to a this new type
      this.type = newType;
    } else if (this.type.kind !== 'Union') {
      // Then we need to convert it into a union type
      const originalType = this.type;
      this.type = new Type('Union')
        .addUnionType(originalType)
        .addUnionType(newType);
    }
    return this;
  }
}
