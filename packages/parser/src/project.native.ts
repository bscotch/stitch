import { pathy } from '@bscotch/pathy';
import { ok } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './project.spec.js';
import { Signifier } from './signifiers.js';
import { Type, type FunctionType, type StructType } from './types.js';
import { primitiveNames } from './types.primitives.js';
import { assert } from './util.js';

export class Native {
  protected spec!: GmlSpec;

  protected constructor(
    readonly filePath: string,
    readonly globalSelf: StructType,
    readonly types: Map<string, Type>,
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
      assert(variable, 'Variable must be defined');
      const type = Type.fromFeatherString(variable.type, this.types);
      const symbol = new Signifier(this.globalSelf, variable.name, type)
        .describe(variable.description)
        .deprecate(variable.deprecated);
      symbol.writable = variable.writable;
      symbol.native = true;
      symbol.global = !variable.instance;
      symbol.instance = variable.instance;
      this.globalSelf.addMember(symbol);
    }
  }

  protected loadFunctions() {
    // As of writing, the `throw` function was not in the spec.
    this.spec.functions.push({
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

    for (const func of this.spec.functions) {
      const typeName = `Function.${func.name}`;
      // Need a type and a symbol for each function.
      const type = (
        this.types.get(typeName) || this.createFunctionType().named(func.name)
      ).describe(func.description);
      this.types.set(typeName, type);

      // Add parameters to the type.
      assert(func.parameters, 'Function must have parameters');
      for (let i = 0; i < func.parameters.length; i++) {
        const param = func.parameters[i];
        assert(param, 'Parameter must be defined');
        const paramType = Type.fromFeatherString(param.type, this.types);
        type
          .addParameter(i, param.name, paramType, param.optional)
          .describe(param.description);
      }
      // Add return type to the type.
      type.addReturnType(Type.fromFeatherString(func.returnType, this.types));

      const symbol = new Signifier(this.globalSelf, func.name, type).deprecate(
        func.deprecated,
      );
      symbol.writable = false;
      symbol.native = true;
      this.globalSelf.addMember(symbol);
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
          assert(constant, 'Constant must be defined');
          const symbol = new Signifier(
            this.globalSelf,
            constant.name,
            Type.fromFeatherString(constant.type, this.types),
          ).describe(constant.description);
          symbol.writable = false;
          symbol.native = true;
          this.globalSelf.addMember(symbol);
        }
        continue;
      }

      // Figure out what types are in use by this class.
      const typeNames = new Set<string>();
      for (const constant of constants) {
        assert(constant, 'Constant must be defined');
        typeNames.add(constant.type);
      }
      ok(typeNames.size, `Class ${klass} has no types`);

      // Create the base type for the class.
      const classTypeName = `Constant.${klass}`;
      const typeString = [...typeNames.values()].join('|');
      const classType = Type.fromFeatherString(typeString, this.types)[0]
        .derive()
        .named(classTypeName);
      const existingType = this.types.get(classTypeName);
      assert(!existingType, `Type ${classTypeName} already exists`);

      this.types.set(classTypeName, classType);

      // Create symbols for each class member.
      for (const constant of constants) {
        const symbol = new Signifier(this.globalSelf, constant.name).describe(
          constant.description,
        );
        symbol.writable = false;
        symbol.def = {}; // Prevent "not found" errors
        symbol.addType(classType);

        this.globalSelf.addMember(symbol);
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
      ok(!structType.listMembers().length, `Type ${typeName} already exists`);
      this.types.set(typeName, structType);

      for (const prop of struct.properties) {
        assert(prop, 'Property must be defined');
        const type = Type.fromFeatherString(prop.type, this.types);
        structType
          .addMember(prop.name, type, prop.writable)
          .describe(prop.description);
      }
    }
  }

  static async from(
    filePath: string | undefined,
    globalSelf: StructType,
    types: Map<string, Type>,
  ): Promise<Native> {
    filePath ||= Native.fallbackGmlSpecPath.absolute;
    const parsedSpec = await Native.parse(filePath);
    const spec = new Native(filePath, globalSelf, types);
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

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}
