import { readFile } from 'fs/promises';
import { parseStringPromise } from 'xml2js';
import {
  GmlSpec,
  GmlSpecConstant,
  GmlSpecFunction,
  GmlSpecVariable,
  gmlSpecSchema,
} from './spec.schema.js';
import { Location } from './symbols.location.js';

export type GmlSymbolKind = 'function' | 'variable' | 'constant';

export abstract class GmlSymbol<T extends { name: string }> {
  readonly name: string;
  abstract readonly kind: GmlSymbolKind;
  refs: Location[] = [];
  constructor(readonly definition: T) {
    this.name = definition.name;
  }

  addRef(location: Location) {
    this.refs.push(location);
  }
}

export class GmlFunction extends GmlSymbol<GmlSpecFunction> {
  readonly kind = 'function';
}

export class GmlVariable extends GmlSymbol<GmlSpecVariable> {
  readonly kind = 'variable';
}

export class GmlConstant extends GmlSymbol<GmlSpecConstant> {
  readonly kind = 'constant';
}

export class GmlType extends GmlSymbol<{ name: string }> {
  readonly kind = 'constant';
}

export class Gml {
  protected spec!: GmlSpec;
  readonly symbols: Map<
    string,
    GmlFunction | GmlVariable | GmlConstant | GmlType
  > = new Map();
  readonly functions: GmlFunction[] = [];
  readonly variables: GmlVariable[] = [];
  readonly constants: GmlConstant[] = [];
  readonly types: GmlType[] = [];

  protected constructor(readonly filePath: string) {}

  get version() {
    return this.spec.runtime;
  }

  protected load() {
    for (const func of this.spec.functions) {
      const gmlFunc = new GmlFunction(func);
      this.functions.push(gmlFunc);
      this.symbols.set(func.name, gmlFunc);
    }
    for (const variable of this.spec.variables) {
      const gmlVar = new GmlVariable(variable);
      this.variables.push(gmlVar);
      this.symbols.set(gmlVar.name, gmlVar);
    }
    for (const constant of this.spec.constants) {
      const gmlConstant = new GmlConstant(constant);
      this.constants.push(gmlConstant);
      this.symbols.set(gmlConstant.name, gmlConstant);
    }
    for (const name of this.spec.types) {
      const gmlType = new GmlType({ name });
      this.types.push(gmlType);
      this.symbols.set(gmlType.name, gmlType);
    }
  }

  static async from(filePath: string) {
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
}
