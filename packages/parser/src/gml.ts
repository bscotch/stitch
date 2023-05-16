import { readFile } from 'fs/promises';
import { parseStringPromise } from 'xml2js';
import {
  gmlSpecSchema,
  type GmlSpec,
  type GmlSpecConstant,
  type GmlSpecFunction,
  type GmlSpecVariable,
} from './gml.schema.js';
import type { Location } from './symbols.location.js';
import type { GmlSymbolKind, SymbolBase, SymbolRefBase } from './types.js';

export type GmlSymbolType = GmlFunction | GmlVariable | GmlConstant | GmlType;

export class GmlSymbolRef implements SymbolRefBase {
  readonly type = 'symbolRef';
  constructor(
    public readonly symbol: GmlSymbolType,
    public readonly location: Location,
  ) {}

  get start() {
    return this.location.startOffset;
  }

  get end() {
    return this.start + this.symbol.name.length;
  }
}

export abstract class GmlSymbol<
  T extends {
    name: string;
    type?: string;
    class?: string;
    description?: string;
    deprecated?: boolean;
    readable?: boolean;
    writable?: boolean;
    instance?: boolean;
  },
> implements SymbolBase
{
  readonly type = 'symbol';
  abstract readonly kind: GmlSymbolKind;
  refs = new Set<GmlSymbolRef>();

  constructor(readonly definition: T) {}

  get code(): string | undefined {
    return undefined;
  }

  get name() {
    return this.definition.name;
  }

  get description() {
    return this.definition.description;
  }

  addRef(location: Location) {
    const ref = new GmlSymbolRef(this as GmlSymbolType, location);
    this.refs.add(ref);
    location.file.addRef(ref);
  }
}

export class GmlFunction extends GmlSymbol<GmlSpecFunction> {
  readonly kind = 'gmlFunction';
  override get code() {
    let code = `function ${this.name}(`;
    for (let i = 0; i < this.definition.parameters.length; i++) {
      const param = this.definition.parameters[i];
      if (i > 0) {
        code += ', ';
      }
      code += param.name;
      if (param.optional) {
        code += '?';
      }
      code += ': ' + param.type.join('|');
    }
    code += '): ' + this.definition.returnType.join('|');
    return code;
  }
}

export class GmlVariable extends GmlSymbol<GmlSpecVariable> {
  readonly kind = 'gmlVariable';
}

export class GmlConstant extends GmlSymbol<GmlSpecConstant> {
  readonly kind = 'gmlConstant';
}

export class GmlType extends GmlSymbol<{ name: string }> {
  readonly kind = 'gmlType';
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
