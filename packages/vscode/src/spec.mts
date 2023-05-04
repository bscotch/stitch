import { readFile } from 'fs/promises';
import { parseStringPromise } from 'xml2js';
import { GmlSpec as GmlSpecType, gmlSpecSchema } from './spec.schemas.mjs';
// @ts-expect-error
import fallbackSpec from '../samples/GmlSpec.xml';
import { GmlConstant } from './spec.constants.mjs';
import { GmlFunction } from './spec.functions.mjs';
import { GmlType } from './spec.types.mjs';
import { GmlVariable } from './spec.variables.mjs';

export class GmlSpec {
  protected spec!: GmlSpecType;
  /**
   * All GML identifiers that are built-in to the language.
   */
  readonly identifiers = new Map<
    string,
    GmlFunction | GmlVariable | GmlConstant | GmlType
  >();
  readonly functions: GmlFunction[] = [];
  readonly variables: GmlVariable[] = [];
  readonly constants: GmlConstant[] = [];
  readonly types: GmlType[] = [];

  protected constructor(readonly filePath: string) {}

  protected async load() {
    this.spec = await GmlSpec.parse(this.filePath);
    for (const func of this.spec.functions) {
      const gmlFunc = new GmlFunction(func);
      this.functions.push(gmlFunc);
      this.identifiers.set(func.name, gmlFunc);
    }
    for (const variable of this.spec.variables) {
      const gmlVar = new GmlVariable(variable);
      this.variables.push(gmlVar);
      this.identifiers.set(gmlVar.name, gmlVar);
    }
    for (const constant of this.spec.constants) {
      const gmlConstant = new GmlConstant(constant);
      this.constants.push(gmlConstant);
      this.identifiers.set(gmlConstant.name, gmlConstant);
    }
    for (const type of this.spec.types) {
      const gmlType = new GmlType(type);
      this.types.push(gmlType);
      this.identifiers.set(gmlType.name, gmlType);
    }
  }

  static async from(filePath: string) {
    const spec = new GmlSpec(filePath);
    await spec.load();
    return spec;
  }

  static async parse(specFilePath?: string): Promise<GmlSpecType> {
    const specRaw = specFilePath
      ? await readFile(specFilePath, 'utf8')
      : (fallbackSpec as string);
    const asJson = await parseStringPromise(specRaw.replace('\ufeff', ''), {
      trim: true,
      normalize: true,
    }); // Prevent possible errors: "Non-white space before first tag"
    return gmlSpecSchema.parse(asJson);
  }
}
