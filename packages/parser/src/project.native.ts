import { Pathy, pathy } from '@bscotch/pathy';
import { GameMakerIde, GameMakerLauncher } from '@bscotch/stitch-launcher';
import { ok } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { logger } from './logger.js';
import { GmlSpec, GmlSpecConstant, gmlSpecSchema } from './project.spec.js';
import { Signifier } from './signifiers.js';
import { Type, type StructType } from './types.js';
import { addSpriteInfoStruct } from './types.sprites.js';
import { assert } from './util.js';

export class Native {
  protected specs!: GmlSpec[];
  objectInstanceBase!: StructType;

  protected constructor(
    readonly globalSelf: StructType,
    readonly types: Map<string, Type>,
  ) {}

  protected load() {
    assert(this.specs.length, 'No specs to load!');

    // Prepare the base object instance type.
    this.objectInstanceBase = new Type('Struct');
    const idInstance = new Type('Id.Instance');
    this.types.set('Id.Instance', idInstance);
    idInstance.extends = this.objectInstanceBase;
    const assetGmObject = new Type('Asset.GMObject');
    assetGmObject.extends = this.objectInstanceBase;
    this.types.set('Asset.GMObject', assetGmObject);

    // The `throw` function is not in the spec, so add it manually.
    const throwsType = new Type('Function').named('throw');
    throwsType.addParameter(0, 'message', Type.Any, false);
    const throws = new Signifier(this.globalSelf, 'throw', throwsType);
    this.globalSelf.addMember(throws);
    this.types.set('Function.throw', throwsType);
    throws.def = {};
    throws.native = 'Base';

    // The `display_get_frequency` function is not in the spec, so add it manually.

    const displayGetFrequencyType = new Type('Function').named(
      'display_get_frequency',
    );
    displayGetFrequencyType.addReturnType(Type.Real);
    const displayGetFrequency = new Signifier(
      this.globalSelf,
      'display_get_frequency',
      displayGetFrequencyType,
    );
    this.globalSelf.addMember(displayGetFrequency);
    this.types.set('Function.display_get_frequency', displayGetFrequencyType);
    displayGetFrequency.def = {};
    displayGetFrequency.native = 'Base';

    // Process all of the found specs
    for (const spec of this.specs) {
      logger.info(`Loading spec for module ${spec.module}`);
      this.loadConstants(spec);
      this.loadVariables(spec);
      this.loadStructs(spec);
      this.loadFunctions(spec);
    }

    // Update the base instance type using instance variables.
    for (const member of this.globalSelf.listMembers()) {
      if (member.instance) {
        this.objectInstanceBase.addMember(member);
      }
    }
    this.objectInstanceBase.isReadonly = true;

    // Have the base Id.Instance and Asset.GmObject types
    // use the object instance base as their parent, and make them readonly.
    idInstance.isReadonly = true;
    assetGmObject.isReadonly = true;
  }

  protected loadVariables(spec: GmlSpec) {
    for (const variable of spec.variables) {
      assert(variable, 'Variable must be defined');
      const type = Type.fromFeatherString(variable.type, this.types, true);
      const symbol = new Signifier(this.globalSelf, variable.name, type)
        .describe(variable.description)
        .deprecate(variable.deprecated);
      symbol.writable = variable.writable;
      symbol.native = variable.module;
      symbol.global = !variable.instance;
      symbol.instance = variable.instance;
      this.globalSelf.addMember(symbol);
    }
  }

  protected loadFunctions(spec: GmlSpec) {
    for (const func of spec.functions) {
      if (this.globalSelf.getMember(func.name)) {
        logger.warn(`Native function ${func.name} already exists, skipping.`);
        continue;
      }

      const typeName = `Function.${func.name}`;
      // Need a type and a symbol for each function.
      const functionType = (
        this.types.get(typeName) || new Type('Function').named(func.name)
      ).describe(func.description);
      this.types.set(typeName, functionType);

      // Create a new generic type for this function (in particular, to be re-used by types that contain it!)
      const genericType = new Type('ArgumentIdentity');
      genericType.isGeneric = true;
      const generics = { ArgumentIdentity: [genericType] };
      const usesGenerics =
        func.parameters?.some((param) =>
          param.name.includes('ArgumentIdentity'),
        ) || func.returnType?.includes('ArgumentIdentity');
      const addGenericToContainer = (typeString: string) => {
        if (!usesGenerics) return typeString;
        const replaced = typeString.replace(
          /^(id.ds[a-z]+|array)(<\w+>)?/i,
          `$1<ArgumentIdentity>`,
        );
        return replaced;
      };

      // Add parameters to the type.
      assert(func.parameters, 'Function must have parameters');
      for (let i = 0; i < func.parameters.length; i++) {
        const param = func.parameters[i];
        assert(param, 'Parameter must be defined');
        const paramType = Type.fromFeatherString(
          addGenericToContainer(param.type),
          [generics, this.types],
          true,
        );
        functionType
          .addParameter(i, param.name, paramType, param.optional)
          .describe(param.description);
      }
      // Add return type to the type.
      functionType.addReturnType(
        Type.fromFeatherString(
          addGenericToContainer(func.returnType),
          [generics, this.types],
          true,
        ),
      );

      const symbol = new Signifier(
        this.globalSelf,
        func.name,
        functionType,
      ).deprecate(func.deprecated);
      symbol.writable = false;
      symbol.native = func.module;
      this.globalSelf.addMember(symbol);
    }
  }

  protected loadConstants(spec: GmlSpec) {
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
    for (const constant of spec.constants) {
      const klass = constant.class || '';
      constantsByClass.set(klass, constantsByClass.get(klass) || []);
      constantsByClass.get(klass)!.push(constant);
    }
    // Then create a type for each class and a symbol for each constant.
    for (const [klass, constants] of constantsByClass) {
      if (!klass) {
        for (const constant of constants) {
          assert(constant, 'Constant must be defined');
          const symbol =
            this.globalSelf.getMember(constant.name) ||
            new Signifier(
              this.globalSelf,
              constant.name,
              Type.fromFeatherString(constant.type, this.types, true),
            ).describe(constant.description);
          symbol.writable = false;
          symbol.native = constant.module;
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
      const classType =
        this.types.get(classTypeName) ||
        Type.fromFeatherString(typeString, this.types, true)[0].named(klass);

      this.types.set(classTypeName, classType);

      // Create symbols for each class member.
      for (const constant of constants) {
        const symbol =
          this.globalSelf.getMember(constant.name) ||
          new Signifier(this.globalSelf, constant.name).describe(
            constant.description,
          );
        symbol.writable = false;
        symbol.native = constant.module;
        symbol.setType(classType);
        const typeName = `${classTypeName}.${constant.name}`;
        this.types.set(typeName, classType);

        this.globalSelf.addMember(symbol);
      }
    }
  }

  protected loadStructs(spec: GmlSpec) {
    // Create struct types. Each one extends the base Struct type.
    addSpriteInfoStruct(this.types);
    for (const struct of spec.structures) {
      if (!struct.name) {
        continue;
      }
      const typeName = `Struct.${struct.name}`;
      const structType =
        this.types.get(typeName) || new Type('Struct').named(struct.name);
      ok(!structType.listMembers().length, `Type ${typeName} already exists`);
      this.types.set(typeName, structType);

      for (const prop of struct.properties) {
        if (prop && !structType.getMember(prop.name)) {
          const type = Type.fromFeatherString(prop.type, this.types, true);
          structType
            .addMember(prop.name, { type, writable: prop.writable })!
            .describe(prop.description);
        }
      }
    }
    // Set all native structs as read-only
    for (const struct of spec.structures) {
      if (!struct.name) {
        continue;
      }
      const typeName = `Struct.${struct.name}`;
      const structType = this.types.get(typeName);
      ok(structType, `Type ${typeName} does not exist`);
      structType.isReadonly = true;
    }
  }

  static async from(
    filePaths: Pathy[] | undefined,
    globalSelf: StructType,
    types: Map<string, Type>,
  ): Promise<Native> {
    filePaths = filePaths || [Native.fallbackGmlSpecPath];
    const parsed = (
      await Promise.all(
        filePaths.map((path) => {
          try {
            return Native.parse(path.absolute);
          } catch (err) {
            logger.error(err);
          }
          return;
        }),
      )
    ).filter((x) => !!x) as GmlSpec[];
    const native = new Native(globalSelf, types);
    native.specs = parsed;
    // Ensure the base module is always first
    native.specs.sort((a, b) => {
      if (a.module.toLowerCase() === 'base') {
        return -1;
      } else if (b.module.toLowerCase() === 'base') {
        return 1;
      }
      return 0;
    });
    native.load();
    return native;
  }

  static async parse(specFilePath: string): Promise<GmlSpec> {
    const specRaw = await readFile(specFilePath, 'utf8');
    const asJson = await parseStringPromise(specRaw.replace('\ufeff', ''), {
      trim: true,
      normalize: true,
      emptyTag() {
        return {};
      },
      // Prevent surprises if modules provide single entries
      explicitArray: true,
    }); // Prevent possible errors: "Non-white space before first tag"
    try {
      return gmlSpecSchema.parse(asJson);
    } catch (err) {
      logger.error(`Error parsing spec file "${specFilePath}"`);
      throw err;
    }
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );

  static async listSpecFiles(options: {
    runtimeVersion?: string;
    ideVersion?: string;
  }): Promise<Pathy[]> {
    if (!options.runtimeVersion && options.ideVersion) {
      logger.warn('No stitch config found, looking up runtime version');
      // Look up the runtime version that matches the project's IDE version.
      const usingRelease = await GameMakerIde.findRelease({
        ideVersion: options.ideVersion,
      });
      options.runtimeVersion = usingRelease?.runtime.version;
    }
    if (options.runtimeVersion) {
      // Find the locally installed runtime folder
      const installedRuntime = await GameMakerLauncher.findInstalledRuntime({
        version: options.runtimeVersion,
      });
      if (installedRuntime) {
        logger.info(
          `Looking for spec files in "${installedRuntime.directory?.absolute}"`,
        );
        const specs = await pathy(
          installedRuntime.directory,
        ).listChildrenRecursively({
          filter(path) {
            return path.basename === 'GmlSpec.xml' || undefined;
          },
          maxDepth: 3,
        });
        if (specs.length) {
          return specs;
        } else {
          logger.warn(
            'Found runtime, but could not find any GmlSpec.xml files!',
          );
        }
      } else {
        logger.warn(
          `Could not find runtime version ${options.runtimeVersion} locally!`,
        );
      }
    }
    logger.warn('Falling back to default GmlSpec.xml included with Stitch.');
    return [Native.fallbackGmlSpecPath];
  }
}
