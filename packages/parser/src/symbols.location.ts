import type { IToken } from 'chevrotain';
import type { GmlFile } from './project.gml.js';

export type FileName = string;

export class Location {
  constructor(
    /** Pathy-normalized absolute path to the file. */
    public readonly file: GmlFile,
    public readonly startOffset: number,
  ) {}

  /**
   * Create a new Location instance within this same file
   * at the given offset. */
  at(offset: number): Location;
  at(token: IToken): Location;
  at(offsetOrToken: number | IToken): Location {
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
