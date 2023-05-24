import type { CstNodeLocation } from 'chevrotain';
import { ok } from 'node:assert';
import type { Symbol } from './types.symbol.js';
import { StructType, Type } from './types.type.js';

export type CstLocation = Required<CstNodeLocation>;

export class Position {
  readonly $tag = 'Pos';
  constructor(
    readonly file: string,
    readonly offset: number,
    readonly line: number,
    readonly column: number,
  ) {}

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
  constructor(readonly symbol: Symbol, start: Position, end: Position) {
    super(start, end);
  }

  static fromRange(range: Range, symbol: Symbol) {
    return new Reference(symbol, range.start, range.end);
  }
}
