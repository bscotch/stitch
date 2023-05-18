import type { GmlFile } from './project.gml.js';

export type FileName = string;

export interface RawLocation {
  startOffset: number;
  startLine?: number;
  startColumn?: number;
  endOffset?: number;
  endLine?: number;
  endColumn?: number;
}

export class Location {
  startOffset: number;
  startLine: number;
  startColumn: number;
  endOffset: number;
  endLine: number;
  endColumn: number;

  constructor(
    /** Pathy-normalized absolute path to the file. */
    public readonly file: GmlFile,
    location: RawLocation,
  ) {
    this.startOffset = location.startOffset;
    this.endOffset = location.endOffset || location.startOffset;
    this.startColumn = location.startColumn || 0;
    this.startLine = location.startLine || 0;
    this.endColumn = location.endColumn || location.startColumn || 0;
    this.endLine = location.endLine || location.startLine || 0;
  }

  /**
   * Create a new Location instance within this same file
   * at the given offset. */
  at(loc: RawLocation): Location {
    return new Location(this.file, loc);
  }

  static from(loc: RawLocation, file: GmlFile) {
    return new Location(file, loc);
  }
}
