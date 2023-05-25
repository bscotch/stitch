import type { CstNodeLocation } from 'chevrotain';
import { ok } from 'node:assert';
import type { Symbol } from './types.symbol.js';
import { StructType, Type, TypeMember } from './types.type.js';
import type { Constructor } from './util.js';

export type CstLocation = Required<CstNodeLocation>;

export class Position {
  readonly $tag = 'Pos';
  constructor(
    readonly file: string,
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

  static fromCstStart(fileName: string, location: CstNodeLocation) {
    return new Position(
      fileName,
      location.startOffset,
      location.startLine!,
      location.startColumn!,
    );
  }

  static fromCstEnd(fileName: string, location: CstNodeLocation) {
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

  get file(): string {
    return this.start.file;
  }

  static fromCst(fileName: string, location: CstNodeLocation) {
    return new Range(
      Position.fromCstStart(fileName, location),
      Position.fromCstEnd(fileName, location),
    );
  }
}

export class Scope extends Range {
  override readonly $tag = 'Scope';
  constructor(
    start: Position,
    readonly local: StructType,
    readonly self: StructType,
  ) {
    super(start);
  }
}

export class Reference extends Range {
  override readonly $tag = 'Ref';
  type: Type = new Type('Unknown');
  constructor(
    readonly item: Symbol | Type | TypeMember,
    start: Position,
    end: Position,
  ) {
    super(start, end);
  }

  static fromRange(range: Range, symbol: Symbol) {
    return new Reference(symbol, range.start, range.end);
  }
}

/** Extend a class to add `def`, `refs`, and related fields and methods. */
export function Refs<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    def: Range | undefined = undefined;
    refs = new Set<Reference>();

    addRef(location: Range, type: Type): this {
      const ref = Reference.fromRange(location, this as any);
      ref.type = type;
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
