import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { primitiveNames } from './project.primitives.js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './project.spec.js';
import { Symbol } from './project.symbol.js';
import { Type, type FunctionType, type StructType } from './project.type.js';

export class Native {
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
      const type = new Type(name);
      type.native = true;
      type.writable = false;
      this.types.set(name, type);
    });
  }

  get version() {
    return this.spec.runtime;
  }

  protected createStructType(): StructType {
    return this.types.get('Struct')!.derive() as StructType;
  }
  protected createFunctionType(): FunctionType {
    return this.types.get('Function')!.derive() as FunctionType;
  }

  protected load() {
    this.loadConstants();
    this.loadVariables();
    this.loadStructs();
    this.loadFunctions();
  }

  protected loadVariables() {
    for (const variable of this.spec.variables) {
      const type = Type.from(variable.type, this.types);
      const symbol = new Symbol(variable.name)
        .describe(variable.description)
        .deprecate(variable.deprecated)
        .addType(type);
      symbol.writable = variable.writable;
      symbol.native = true;
      symbol.global = !variable.instance;
      symbol.instance = variable.instance;
      if (variable.instance) {
        this.instance.set(symbol.name, symbol);
      } else {
        this.global.set(symbol.name, symbol);
      }
    }
  }

  protected loadFunctions() {
    for (const func of this.spec.functions) {
      const typeName = `Function.${func.name}`;
      // Need a type and a symbol for each function.
      const type = (
        this.types.get(typeName) || this.createFunctionType().named(func.name)
      ).describe(func.description);
      type.native = true;
      type.writable = false;
      this.types.set(typeName, type);

      // Add parameters to the type.
      for (let i = 0; i < func.parameters.length; i++) {
        const param = func.parameters[i];
        const paramType = Type.from(param.type, this.types);
        type
          .addParameter(i, param.name, paramType, param.optional)
          .describe(param.description);
      }
      // Add return type to the type.
      type.addReturnType(Type.from(func.returnType, this.types));

      const symbol = new Symbol(func.name)
        .deprecate(func.deprecated)
        .addType(type);
      symbol.writable = false;
      type.native = true;
      this.global.set(symbol.name, symbol);
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
            .describe(constant.description)
            .addType(Type.from(constant.type, this.types));
          symbol.writable = false;
          symbol.native = true;
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
        const symbol = new Symbol(constant.name).describe(constant.description);
        symbol.writable = false;
        symbol.addType(classType);
        this.global.set(symbol.name, symbol);
      }
    }
  }

  protected loadStructs() {
    // Create struct types. Each one extends the base Struct type.
    for (const struct of this.spec.structures) {
      if (!struct.name) {
        continue;
      }
      const typeName = `Struct.${struct.name}`;
      const structType =
        this.types.get(typeName) || this.createStructType().named(struct.name);
      ok(!structType.members?.length, `Type ${typeName} already exists`);
      this.types.set(typeName, structType);

      for (const prop of struct.properties) {
        const type = Type.from(prop.type, this.types);
        structType
          .addMember(prop.name, type, prop.writable)
          .describe(prop.description);
      }
    }
  }

  static async from(filePath: string = Native.fallbackGmlSpecPath.absolute) {
    const parsedSpec = await Native.parse(filePath);
    const spec = new Native(filePath);
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
