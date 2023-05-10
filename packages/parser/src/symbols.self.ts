import type { GameMakerProjectParser } from './project.js';
import type { GameMakerResource } from './project.resource.js';
import type {
  Enum,
  GlobalVariable,
  Macro,
  SelfVariable,
} from './symbols.symbol.js';

export abstract class Self {}

export class StructSelf extends Self {
  /** Instance-defined symbols. */
  symbols = new Map<string, SelfVariable>();
}

export class InstanceSelf extends StructSelf {
  constructor(public readonly name: string) {
    super();
  }
}

/**
 * For self-contexts that have not been mapped onto a known self,
 * e.g. for unbound functions.
 */
export class UnknownSelf extends Self {}
export class AssetSelf extends Self {
  constructor(public readonly name: string) {
    super();
  }
}

export type GlobalSymbol =
  | GlobalVariable
  | Macro
  | Enum
  | InstanceSelf
  | AssetSelf
  | GameMakerResource;

export class GlobalSelf extends Self {
  /** Project-defined symbols. */
  symbols = new Map<string, GlobalSymbol>();

  constructor(public readonly project: GameMakerProjectParser) {
    super();
  }

  addSymbol(symbol: GlobalSymbol) {
    this.symbols.set(symbol.name, symbol);
  }

  get gml() {
    return this.project.spec.symbols;
  }
}
