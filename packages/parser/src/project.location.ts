import type { CstNodeLocation, IToken } from 'chevrotain';
import type { Code } from './project.code.js';
import type { Signifier } from './signifiers.js';
import { EnumType, FunctionType, StructType, Type } from './types.js';
import { assert, type Constructor } from './util.js';

export const firstLineIndex = 1;
export const firstColumnIndex = 1;

export type CstLocation = Required<CstNodeLocation>;
export interface IPosition {
  offset: number;
  line: number;
  column: number;
}

export interface IRange {
  start: IPosition;
  end: IPosition;
}

/**
 * Single-character tokens do not have correct end
 * location information. This function checks the `image`
 * of the token and fixes the end location if necessary.
 */
export function fixITokenLocation(token: IToken) {
  assert(typeof token.image === 'string', 'Token must have an image');
  const length = token.image.length;
  if (token.endOffset === token.startOffset) {
    token.endOffset += length;
  }
  if (token.endColumn === token.startColumn) {
    token.endColumn! += length;
  }
  return token;
}

export type LinePosition = { line: number; column: number };

export class Position implements IPosition {
  readonly $tag = 'Pos';
  constructor(
    readonly file: Code,
    public offset: number,
    public line: number,
    public column: number,
  ) {}

  /**
   * Create a new Positiong instance within this same file
   * at the given location. */
  at(loc: CstNodeLocation): Position {
    return Position.fromCstStart(this.file, loc);
  }

  /**
   * Create a new location starting at the end of
   * the given location.
   */
  atEnd(loc: CstNodeLocation): Position {
    return Position.fromCstEnd(this.file, loc);
  }

  static from(
    file: Code,
    loc: CstNodeLocation | Position | IPosition,
    fromTokenEnd = false,
  ): Position {
    if (loc instanceof Position) {
      return loc;
    }
    if ('offset' in loc) {
      return new Position(file, loc.offset, loc.line, loc.column);
    }
    return fromTokenEnd
      ? Position.fromCstEnd(file, loc)
      : Position.fromCstStart(file, loc);
  }

  static fromFileStart(fileName: Code) {
    return new Position(fileName, 0, firstLineIndex, firstColumnIndex);
  }

  static fromCstStart(fileName: Code, location: CstNodeLocation) {
    return new Position(
      fileName,
      location.startOffset ?? 0,
      location.startLine ?? firstLineIndex,
      location.startColumn ?? firstColumnIndex,
    );
  }

  static fromCstEnd(fileName: Code, location: CstNodeLocation) {
    return new Position(
      fileName,
      location.endOffset ?? 0,
      location.endLine ?? firstLineIndex,
      location.endColumn ?? firstColumnIndex,
    );
  }
}

export class Range implements IRange {
  $tag = 'Range';
  public start: Position;
  public end: Position;

  constructor(start: Position, end?: Position) {
    // We can get into some weird cases when recovering
    // from parse errors, so do some checks with graceful
    // recovery.
    this.start = start;
    this.end = end ?? start;
    if (this.end.offset < this.start.offset) {
      this.end = this.start;
    }
  }

  get file(): Code {
    return this.start.file;
  }

  static from(file: Code, location: IRange | CstNodeLocation): Range {
    if ('start' in location) {
      return new Range(
        Position.from(file, location.start),
        Position.from(file, location.end),
      );
    }
    return Range.fromCst(file, location);
  }

  static fromCst(fileName: Code, location: CstNodeLocation) {
    return new Range(
      Position.fromCstStart(fileName, location),
      Position.fromCstEnd(fileName, location),
    );
  }
}

/**
 * A code range corresponding with a specific function argument.
 * Useful for providing signature help.
 */
export class FunctionArgRange extends Range {
  override $tag = 'ArgRange';
  hasExpression = false;
  constructor(
    /** The function reference this call belongs to */
    readonly type: FunctionType,
    /** The index of the parameter we're in. */
    readonly idx: number,
    start: Position,
    end?: Position,
  ) {
    super(start, end);
  }

  get param(): Signifier {
    assert(this.type, 'FunctionArgRange must have a type');
    return this.type.getParameter(this.idx)!;
  }
}

/** Extend a class to add `def`, `refs`, and related fields and methods. */
export function Refs<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    /**
     * If `true`, then this definitely exists but may not have a place where it
     * is declared. E.g. the `global` variable. In that case this would be set to
     * `true`. Otherwise `undefined` is interpreted to mean that this thing
     * does not have a definite declaration.
     */
    def: Range | { file?: undefined } | undefined = undefined;
    refs = new Set<Reference>();

    addRef(location: Range): Reference {
      const ref = Reference.fromRange(location, this as any);
      this.refs.add(ref);
      location.file.addRef(ref);
      return ref;
    }

    definedAt(location: Range | undefined): this {
      this.def = location;
      return this;
    }
  };
}

export class Referenceable extends Refs(class {}) {}

export const enum ScopeFlag {
  DotAccessor = 1 << 0,
}

export class Scope extends Range {
  override readonly $tag = 'Scope';
  /** The immediately adjacent ScopeRange */
  protected _next: Scope | undefined = undefined;
  public flags = 0;
  constructor(
    start: Position,
    public local: StructType,
    public self: StructType | EnumType,
  ) {
    super(start);
  }

  set isDotAccessor(value: boolean) {
    if (value) {
      this.flags |= ScopeFlag.DotAccessor;
    } else {
      this.flags &= ~ScopeFlag.DotAccessor;
    }
  }
  get isDotAccessor(): boolean {
    return !!(this.flags & ScopeFlag.DotAccessor);
  }

  setEnd(atToken: CstNodeLocation | Position, fromTokenEnd = false) {
    this.end = Position.from(this.file, atToken, fromTokenEnd);
  }

  /**
   * Create the next ScopeRange, adjacent to this one.
   * This sets the end location of this scope range to
   * match the start location of the next one. The self
   * and local values default to the same as this scope range,
   * so at least one will need to be changed!
   */
  createNext(atToken: CstNodeLocation, fromTokenEnd = false): Scope {
    assert(
      this.end,
      'Cannot create a next scope range without an end to this one.',
    );
    assert(
      !this._next,
      'Cannot create a next scope range when one already exists.',
    );
    const start = Position.from(this.file, atToken, fromTokenEnd);
    this._next = new Scope(start, this.local, this.self);
    return this._next;
  }
}

export type ReferenceableType = Signifier;

export class Reference<
  T extends ReferenceableType = ReferenceableType,
> extends Range {
  override readonly $tag = 'Ref';
  type: Type = new Type('Unknown');
  constructor(readonly item: T, start: Position, end: Position) {
    super(start, end);
  }

  static fromRange(range: Range, item: ReferenceableType) {
    assert(range, 'Cannot create a reference from an undefined range.');
    return new Reference(item, range.start, range.end);
  }
}
