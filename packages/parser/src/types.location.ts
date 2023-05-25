import type { CstNodeLocation } from 'chevrotain';
import { ok } from 'node:assert';
import type { GmlFile } from './types.code.js';
import type { Symbol } from './types.symbol.js';
import { StructType, Type, TypeMember } from './types.type.js';
import type { Constructor } from './util.js';

export const firstLineIndex = 1;
export const firstColumnIndex = 1;

export type CstLocation = Required<CstNodeLocation>;

export class Position {
  readonly $tag = 'Pos';
  constructor(
    readonly file: GmlFile,
    readonly offset: number,
    readonly line: number,
    readonly column: number,
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

  static fromFileStart(fileName: GmlFile) {
    return new Position(fileName, 0, firstLineIndex, firstColumnIndex);
  }

  static fromCstStart(fileName: GmlFile, location: CstNodeLocation) {
    return new Position(
      fileName,
      location.startOffset,
      location.startLine!,
      location.startColumn!,
    );
  }

  static fromCstEnd(fileName: GmlFile, location: CstNodeLocation) {
    return new Position(
      fileName,
      location.endOffset!,
      location.endLine!,
      location.endColumn!,
    );
  }
}

export class Range {
  $tag = 'Range';
  public start: Position;
  public end: Position;

  constructor(start: Position, end?: Position) {
    this.start = start;
    if (end) {
      ok(end.offset >= start.offset, 'Range end must be after start');
    }
    this.end = end ?? start;
  }

  get file(): GmlFile {
    return this.start.file;
  }

  static fromCst(fileName: GmlFile, location: CstNodeLocation) {
    return new Range(
      Position.fromCstStart(fileName, location),
      Position.fromCstEnd(fileName, location),
    );
  }
}

export class Scope extends Range {
  override readonly $tag = 'Scope';
  /** The immediately adjacent ScopeRange */
  protected _next: Scope | undefined = undefined;
  constructor(
    start: Position,
    public local: StructType,
    public self: StructType,
  ) {
    super(start);
  }

  /**
   * Create the next ScopeRange, adjacent to this one.
   * This sets the end location of this scope range to
   * match the start location of the next one. The self
   * and local values default to the same as this scope range,
   * so at least one will need to be changed!
   */
  createNext(atToken: CstNodeLocation, fromTokenEnd = false): Scope {
    this.end = fromTokenEnd
      ? this.start.atEnd(atToken)
      : this.start.at(atToken);
    ok(
      !this._next,
      'Cannot create a next scope range when one already exists.',
    );
    this._next = new Scope(this.end, this.local, this.self);

    return this._next;
  }
}

export type ReferenceableType = Symbol | Type | TypeMember;

export class Reference extends Range {
  override readonly $tag = 'Ref';
  type: Type = new Type('Unknown');
  constructor(
    readonly item: ReferenceableType,
    start: Position,
    end: Position,
  ) {
    super(start, end);
  }

  static fromRange(range: Range, item: ReferenceableType) {
    return new Reference(item, range.start, range.end);
  }
}

/** Extend a class to add `def`, `refs`, and related fields and methods. */
export function Refs<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    def: Range | undefined = undefined;
    refs = new Set<Reference>();

    addRef(location: Range, type?: Type): this {
      const ref = Reference.fromRange(location, this as any);
      // TODO: Improve the type tracing!
      if (type) {
        ref.type = type;
      }
      this.refs.add(ref);
      return this;
    }

    definedAt(location: Range | undefined): this {
      this.def = location;
      return this;
    }
  };
}

export class Referenceable extends Refs(class {}) {}
