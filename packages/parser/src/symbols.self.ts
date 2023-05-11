import type { GameMakerProjectParser } from './project.js';
import { Location } from './symbols.location.js';
import type {
  Enum,
  GlobalConstructorFunction,
  GlobalFunction,
  GlobalVariable,
  Macro,
  SelfVariable,
} from './symbols.symbol.js';

export abstract class Self {
  abstract kind: string;
  refs: Location[] = [];
  location?: Location;
  addRef(location: Location) {
    this.refs.push(location);
  }
}

export class StructSelf extends Self {
  kind = 'struct';
  /** Instance-defined symbols. */
  symbols = new Map<string, SelfVariable>();

  hasSymbol(name: string) {
    return this.symbols.has(name);
  }

  getSymbol(name: string) {
    return this.symbols.get(name);
  }
}

export class InstanceSelf extends StructSelf {
  global = true;
  override kind = 'instance';
  constructor(public readonly name: string) {
    super();
  }
}

/**
 * For self-contexts that have not been mapped onto a known self,
 * e.g. for unbound functions.
 */
export class UnknownSelf extends Self {
  kind = 'unknown';
}
export class AssetSelf extends Self {
  global = true;
  kind = 'asset';
  constructor(public readonly name: string) {
    super();
  }
}

export type GlobalSymbol =
  | GlobalVariable
  | GlobalFunction
  | GlobalConstructorFunction
  | Macro
  | Enum
  | InstanceSelf
  | AssetSelf;

export class GlobalSelf extends Self {
  global = true;
  kind = 'global';
  /** Project-defined symbols. */
  symbols = new Map<string, GlobalSymbol>();

  constructor(public readonly project: GameMakerProjectParser) {
    super();
  }

  addSymbol(symbol: GlobalSymbol) {
    if (!this.hasSymbol(symbol.name)) {
      this.symbols.set(symbol.name, symbol);
    }
    // TODO: else throw?
    return this.getSymbol(symbol.name);
  }

  hasSymbol(name: string) {
    return this.symbols.has(name);
  }

  getSymbol(name: string) {
    return this.symbols.get(name);
  }

  get gml() {
    return this.project.spec.symbols;
  }
}
