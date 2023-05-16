import type { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';
import type { GameMakerProjectParser } from './project.js';
import { Location } from './symbols.location.js';
import {
  Enum,
  GlobalConstructorFunction,
  GlobalFunction,
  GlobalVariable,
  Macro,
  SelfVariable,
} from './symbols.symbol.js';

export class SelfRef {
  constructor(
    public readonly self: Self,
    public readonly location: Location,
    public readonly isDeclaration = false,
  ) {}

  get start() {
    return this.location.startOffset;
  }

  get end() {
    return this.start + (this.self.name?.length || 0);
  }
}

export abstract class Self {
  abstract kind: string;
  refs = new Set<SelfRef>();

  location?: Location;

  constructor(public readonly name?: string) {}
  addRef(location: Location, isDeclaration = false) {
    const ref = new SelfRef(this, location, isDeclaration);
    this.refs.add(ref);
    // location.file.addRef(ref);
  }
}

export class StructSelf extends Self {
  kind = 'struct';
  /** Instance-defined symbols. */
  symbols = new Map<string, SelfVariable>();

  constructor(name?: string) {
    super(name);
  }

  hasSymbol(name: string) {
    return this.symbols.has(name);
  }

  getSymbol(name: string) {
    return this.symbols.get(name);
  }

  addSymbol(file: GmlFile, token: IToken, isStatic = false) {
    const location = new Location(file, token);
    const existing = this.symbols.get(token.image);
    if (existing) {
      existing.addRef(location);
      return;
    }
    const symbol = new SelfVariable(token.image, location, isStatic);
    this.symbols.set(token.image, symbol);
    symbol.addRef(location, true);
  }
}

export class InstanceSelf extends StructSelf {
  global = true;
  override kind = 'instance';
  constructor(name: string) {
    super(name);
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
  constructor(name: string) {
    super(name);
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
    super('global');
  }

  addSymbol(symbol: GlobalSymbol) {
    if (!this.hasSymbol(symbol.name!)) {
      this.symbols.set(symbol.name!, symbol);
    }
    // TODO: else throw?
    return this.getSymbol(symbol.name!);
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
