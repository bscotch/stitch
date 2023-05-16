import type { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';
import type { GameMakerProjectParser } from './project.js';
import { Location } from './symbols.location.js';
import {
  SelfSymbol,
  type Enum,
  type GlobalFunction,
  type GlobalVar,
  type Macro,
} from './symbols.symbol.js';
import { SelfKind } from './types.js';

export type SelfType = StructSelf | GlobalSelf | InstanceSelf | AssetSelf;

export type GlobalSymbol =
  | InstanceSelf
  | AssetSelf
  | GlobalVar
  | GlobalFunction
  | Macro
  | Enum;

export class SelfRef {
  constructor(
    public readonly self: SelfType,
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

abstract class Self<T extends SelfSymbol | GlobalSymbol | never> {
  readonly type = 'self';
  abstract kind: SelfKind;
  refs = new Set<SelfRef>();
  symbols = new Map<string, T>();

  location?: Location;

  constructor(public readonly name?: string) {}
  addRef(location: Location, isDeclaration = false) {
    const ref = new SelfRef(this as any, location, isDeclaration);
    this.refs.add(ref);
    // location.file.addRef(ref);
  }

  hasSymbol(name: string): boolean {
    return this.symbols.has(name);
  }

  getSymbol(name: string): T | undefined {
    return this.symbols.get(name);
  }
}

export class StructSelf extends Self<SelfSymbol> {
  readonly kind = 'struct';

  constructor(name?: string) {
    super(name);
  }
  addSymbol(file: GmlFile, token: IToken, isStatic = false) {
    const location = new Location(file, token);
    const existing = this.symbols.get(token.image);
    if (existing) {
      existing.addRef(location);
      return;
    }
    const symbol = new SelfSymbol(token.image, location, isStatic);
    this.symbols.set(token.image, symbol);
    symbol.addRef(location, true);
  }
}

export class InstanceSelf extends Self<SelfSymbol> {
  readonly kind = 'instance';
}

export class AssetSelf extends Self<SelfSymbol> {
  readonly kind = 'asset';
}

export class GlobalSelf extends Self<GlobalSymbol> {
  readonly kind = 'global';
  global = true;

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

  get gml() {
    return this.project.spec.symbols;
  }
}
