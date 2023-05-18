import { randomString } from '@bscotch/utility';
import type { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';
import type { GameMakerProjectParser } from './project.js';
import { Location } from './project.locations.js';
import {
  SelfSymbol,
  type Enum,
  type GlobalFunction,
  type GlobalVar,
  type Macro,
} from './project.symbols.js';
import { SelfKind } from './types.js';

export type SelfType = StructSelf | GlobalSelf | InstanceSelf;

export type GlobalSymbolType =
  | InstanceSelf
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

abstract class Self<T extends SelfSymbol | GlobalSymbolType | never> {
  readonly type = 'self';
  abstract kind: SelfKind;
  refs = new Set<SelfRef>();
  symbols = new Map<string, T>();

  location?: Location;

  constructor(public readonly name: string, location: Location | undefined) {
    if (location) {
      this.addRef(location, true);
      // Add a self-ref to the self
      const symbol = new SelfSymbol('self', location);
      this.symbols.set('self', symbol as T);
    }
  }

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

  constructor(name: string | undefined, location: Location) {
    super(
      name || `unknown-${randomString(12, 'lowerAlphanumeric')}}`,
      location,
    );
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
  }
}

export class InstanceSelf extends Self<SelfSymbol> {
  readonly kind = 'instance';
  override location = undefined;
}

export class GlobalSelf extends Self<GlobalSymbolType> {
  readonly kind = 'global';
  global = true;

  constructor(public readonly project: GameMakerProjectParser) {
    super('global', undefined);
  }

  addSymbol(symbol: GlobalSymbolType) {
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
