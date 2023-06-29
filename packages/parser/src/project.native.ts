import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { typeToFeatherString } from './jsdoc.feather.js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './project.spec.js';
import { Signifier } from './signifiers.js';
import { typeFromFeatherString } from './types.feather.js';
import { Type, type StructType } from './types.js';
import { primitiveNames } from './types.primitives.js';
import { assert } from './util.js';

export class Native {
  protected spec!: GmlSpec;
  /**
   * Types, looked up by their Feather-compatible name.
   * Types can be either a single type or a type union.
   */
  readonly types: Map<string, Type> = new Map();

  protected constructor(
    readonly filePath: string,
    readonly globalSelf: StructType,
  ) {
    // Initialize all of the primitives so we can guarantee
    // they exist on any lookup.
    primitiveNames.forEach((name) => {
      const type = new Type(name);
      this.types.set(name, type);
    });
  }

  get version() {
    return this.spec.runtime;
  }

  protected load() {
    this.loadConstants();
    this.loadVariables();
    this.loadStructs();
    this.loadFunctions();
  }

  /** Given a feather string, get a new Type instance and ensure that the type
   * exists in the knownTypes map.
   */
  typesFromFeatherString(typeString: string) {
    const types = typeFromFeatherString(typeString, this.types);
    for (const type of types) {
      if (type.name) {
        this.types.set(typeToFeatherString(type), type);
      }
    }
    return types;
  }

  protected loadVariables() {
    for (const variable of this.spec.variables) {
      assert(variable, 'Variable must be defined');
      const type = this.typesFromFeatherString(variable.type);
      const symbol = new Signifier(this.globalSelf, variable.name)
        .describe(variable.description)
        .deprecate(variable.deprecated)
        .setType(type);
      symbol.writable = variable.writable;
      symbol.native = true;
      symbol.global = !variable.instance;
      symbol.instance = variable.instance;
      this.globalSelf.setMember(symbol);
    }
  }

  protected loadFunctions() {
    for (const func of this.spec.functions) {
      const typeName = `Function.${func.name}`;
      // Need a type and a symbol for each function.
      const type = this.typesFromFeatherString(typeName)[0];

      // Add parameters to the type.
      for (let i = 0; i < func.parameters.length; i++) {
        const paramDef = func.parameters[i];
        assert(paramDef, 'Parameter must be defined');
        const paramType = this.typesFromFeatherString(paramDef.type);
        type
          .setParam(i, paramDef.name, paramType, paramDef.optional)
          .describe(paramDef.description);
      }
      // Add return type to the type.
      type.setReturnType(this.typesFromFeatherString(func.returnType));

      const symbol = new Signifier(this.globalSelf, func.name)
        .deprecate(func.deprecated)
        .setType(type);
      symbol.writable = false;
      symbol.native = true;
      this.globalSelf.setMember(symbol);
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

    // Create the `Constant.<class>` types
    for (const [klass, constants] of constantsByClass) {
      if (!klass) {
        continue;
      }
      // Figure out what types are in use by this class.
      const typeNames = new Set<string>();
      for (const constant of constants) {
        assert(constant, 'Constant must be defined');
        typeNames.add(constant.type);
      }
      ok(typeNames.size === 1, `Class ${klass} has unexpected number of types`);

      // Ensure the base type for the class. These are a wonky case -- figure
      // out the primitive type and then create a named type that extends it.
      const classTypeName = `Constant.${klass}`;
      assert(
        !this.types.get(classTypeName),
        `Type ${classTypeName} already exists`,
      );
      const typeString = [...typeNames.values()][0];
      const classType = this.typesFromFeatherString(typeString)[0]
        .extend()
        .setName(classTypeName);
      this.types.set(classTypeName, classType);
    }

    // Then create a type for each class and a symbol for each constant.
    for (const [klass, constants] of constantsByClass) {
      if (!klass) {
        for (const constant of constants) {
          assert(constant, 'Constant must be defined');
          const symbol = new Signifier(this.globalSelf, constant.name)
            .describe(constant.description)
            .setType(this.typesFromFeatherString(constant.type));
          symbol.writable = false;
          symbol.native = true;
          this.globalSelf.setMember(symbol);
        }
        continue;
      }

      const classType = this.types.get(`Constant.${klass}`)!;
      // Create symbols for each class member.
      for (const constant of constants) {
        const symbol = new Signifier(
          this.globalSelf,
          constant.name,
          classType,
        ).describe(constant.description);
        symbol.writable = false;
        symbol.def = {}; // Prevent "not found" errors
        this.globalSelf.setMember(symbol);
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
      const structType = this.typesFromFeatherString(typeName)[0];
      ok(!structType.listMembers().length, `Type ${typeName} already defined`);

      for (const prop of struct.properties) {
        assert(prop, 'Property must be defined');
        const type = this.typesFromFeatherString(prop.type);
        structType
          .setMember(prop.name, type, prop.writable)
          .describe(prop.description);
      }
    }
  }

  static async from(
    filePath: string = Native.fallbackGmlSpecPath.absolute,
    globalSelf: StructType,
  ) {
    const parsedSpec = await Native.parse(filePath);
    const spec = new Native(filePath, globalSelf);
    spec.spec = parsedSpec;
    // Add missing content
    spec.spec.functions.push({
      name: 'throw',
      description: 'Throws an error with the given message.',
      parameters: [
        {
          name: 'message',
          type: 'Any',
          description: 'The message to throw. Can be any type.',
          optional: false,
          coerce: undefined,
        },
      ],
      returnType: 'Never',
      deprecated: false,
      locale: undefined,
      featureFlag: undefined,
      pure: true,
    });

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

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}
