import { ok } from 'assert';
import type { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';

export type FileName = string;
export type TokenOrOffset = IToken | number;

export function asStartOffset(token: IToken | number): number {
  return typeof token === 'number' ? token : token.startOffset;
}

export function asEndOffset(token: IToken | number): number {
  if (typeof token !== 'number') {
    ok(token.endOffset !== undefined, 'Token has no endOffset');
  }
  return typeof token === 'number' ? token : token.endOffset!;
}

export class Location {
  constructor(
    /** Pathy-normalized absolute path to the file. */
    public readonly file: GmlFile,
    public readonly offset: number,
  ) {}

  /**
   * Create a new Location instance within this same file
   * at the given offset. */
  at(offset: number): Location;
  at(token: IToken): Location;
  at(offsetOrToken: TokenOrOffset): Location {
    const offset =
      typeof offsetOrToken === 'number'
        ? offsetOrToken
        : offsetOrToken.startOffset;
    return new Location(this.file, offset);
  }

  static from(token: IToken, file: GmlFile) {
    return new Location(file, token.startOffset);
  }
}
