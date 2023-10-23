export interface Range {
  /**
   * The start position. It is before or equal to {@link Range.end end}.
   */
  start: Position;

  /**
   * The end position. It is after or equal to {@link Range.start start}.
   */
  end: Position;
}

export interface Position {
  /**
   * The zero-based line value.
   */
  line: number;

  /**
   * The zero-based character value.
   */
  character: number;

  /**
   * The zero-based index of the position in the document.
   */
  index: number;
}
