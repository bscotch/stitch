import type { Location } from './symbols.location.js';

export interface SymbolBase {
  get name(): string;
  get description(): string | undefined;
  addRef(location: Location): void;
  /** Markdown code snippet representing this symbol, e.g. its function signature */
  get code(): string | undefined;
}

export interface SymbolRefBase {
  readonly symbol: SymbolBase;
  readonly location: Location;
  get start(): number;
  get end(): number;
}
