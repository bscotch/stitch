export interface Location {
  idx: number;
  line: number;
  col: number;
}

export class CharacterStream {
  private pos: number = 0;
  private line: number = 1;
  private col: number = 0;
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  *[Symbol.iterator]() {
    while (!this.eof()) {
      yield this.next();
    }
  }

  get location(): Location {
    return {
      idx: this.pos,
      line: this.line,
      col: this.col,
    };
  }

  next() {
    const ch = this.peak();
    this.pos++;
    if (ch === '\n') {
      this.line += 1;
      this.col = 0;
    } else {
      this.col++;
    }
    return ch;
  }

  /**
   * Peak at the character at the current position,
   * optionally plus an offset.
   */
  peak(offset = 0) {
    return this.input.charAt(this.pos + offset);
  }

  eof() {
    return this.peak() === '';
  }

  croak(msg: string) {
    throw new Error(`${msg} (${this.line}:${this.col})`);
  }
}
