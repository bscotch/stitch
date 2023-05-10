import type { GameMakerProjectParser } from './project.js';
import { Enum, GlobalVariable, Macro, SelfVariable } from './symbols.symbol.js';

export abstract class Self {
  symbols = new Map<string, unknown>();
}

export class StructSelf extends Self {
  /** Instance-defined symbols. */
  override symbols = new Map<string, SelfVariable>();
}

export class InstanceSelf extends StructSelf {}

export class GlobalSelf extends Self {
  /** Project-defined symbols. */
  override symbols = new Map<
    string,
    GlobalVariable | Macro | Enum | InstanceSelf
  >();

  constructor(public readonly project: GameMakerProjectParser) {
    super();
  }

  get gml() {
    return this.project.spec.symbols;
  }
}
