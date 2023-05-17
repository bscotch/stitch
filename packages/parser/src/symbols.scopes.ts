import { ok } from 'assert';
import { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';
import { Location, RawLocation } from './symbols.location.js';
import type { SelfType } from './symbols.self.js';
import { LocalVar } from './symbols.symbol.js';

/**
 * A region of code that has access to a single combination of
 * local and self variables. Scope ranges do not overlap and are not
 * nested. Two scope ranges can map to the same pair of local and self vars.
 */
export class ScopeRange {
  /** The immediately adjacent ScopeRange */
  protected _next: ScopeRange | undefined = undefined;
  readonly start: Location;

  constructor(
    public self: SelfType,
    public local: LocalScope,
    start: Location | GmlFile,
    public end: Location | undefined = undefined,
  ) {
    this.start =
      start instanceof Location
        ? start
        : new Location(start, { startOffset: 0 });
  }

  get localVariables() {
    return [...this.local.symbols.values()];
  }

  /**
   * Create the next ScopeRange, adjacent to this one.
   * This sets the end location of this scope range to
   * match the start location of the next one. The self
   * and local values default to the same as this scope range,
   * so at least one will need to be changed!
   */
  createNext(atToken: RawLocation): ScopeRange {
    this.end = this.start.at(atToken);
    ok(
      !this._next,
      'Cannot create a next scope range when one already exists.',
    );
    this._next = new ScopeRange(this.self, this.local, this.end);
    return this._next;
  }
}

/**
 * A collection of local variables that are all available at the same time.
 */
export class LocalScope {
  /** Local variable declarations */
  readonly symbols = new Map<string, LocalVar>();
  readonly start: Location;

  constructor(location: Location | GmlFile) {
    this.start =
      location instanceof Location
        ? location
        : new Location(location, { startOffset: 0 });
  }

  hasSymbol(name: string) {
    return this.symbols.has(name);
  }

  getSymbol(name: string) {
    return this.symbols.get(name);
  }

  addSymbol(token: IToken, isParam = false) {
    // TODO: If this variable already exists, emit a warning
    const location = new Location(this.start.file, token);
    const existing = this.symbols.get(token.image);
    if (existing) {
      existing.addRef(location);
      return;
    }
    const symbol = new LocalVar(token.image, this.start.at(token), isParam);
    this.symbols.set(token.image, symbol);
    symbol.addRef(location, true);
  }
}
