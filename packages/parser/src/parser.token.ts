import { CharacterStream, Location } from './parser.character.js';
import {
  Position,
  TokenKind,
  keywords,
  operators,
  punctuation,
  whitespace,
} from './parser.types.js';

const characterTypes = {} as const;

export class Token {
  constructor(
    readonly type: TokenKind,
    readonly value: string,
    readonly location: Location,
  ) {}

  get range(): [number, number] {
    return [this.location.idx, this.location.idx + this.value.length];
  }

  get position(): Position {
    return {
      line: this.location.line,
      column: this.location.col,
    };
  }

  toJSON() {
    return {
      type: this.type,
      value: this.value,
      location: this.location,
    };
  }
}

export class TokenStream {
  protected static keywords = new Set(keywords);
  protected static whitespace = new Set(whitespace);
  protected static punctuation = new Set(punctuation);
  protected static operators = new Set(operators);

  protected input: CharacterStream;
  protected current: Token | null = null;

  constructor(input: CharacterStream) {
    this.input = input;
  }

  peek() {
    const current = this.current || (this.current = this.readNext());
    return current;
  }

  next(): Token | null {
    const tok = this.current;
    this.current = null;
    return tok || this.readNext();
  }

  eof() {
    return this.peek() === null;
  }

  *[Symbol.iterator](): Generator<Token | null> {
    while (!this.input.eof()) {
      yield this.readNext();
    }
  }

  protected readNext(): Token | null {
    // Consume whitespace
    this.readWhile((ch) => this.isWhitespace(ch));
    if (this.input.eof()) {
      return null;
    }

    // Peak the next character to decide how to proceed
    const ch = this.input.peak();
    const location = this.input.location;

    // SKIP COMMENTS FOR NOW
    if (ch === '/') {
      const nextChar = this.input.peak(1);
      if (nextChar === '/') {
        this.skipUntilEol();
        return this.readNext();
      }
      if (nextChar === '*') {
        this.input.next();
        this.input.next();
        while (!this.input.eof()) {
          const ch = this.input.next();
          if (ch === '*') {
            if (this.input.peak() === '/') {
              this.input.next();
              break;
            }
          }
        }
        return this.readNext();
      }
    }
    const bracketType =
      ch === '('
        ? TokenKind.LeftParen
        : ch === ')'
        ? TokenKind.RightParen
        : ch === '{'
        ? TokenKind.LeftBrace
        : ch === '}'
        ? TokenKind.RightBrace
        : ch === '['
        ? TokenKind.LeftBracket
        : ch === ']'
        ? TokenKind.RightBracket
        : ch === ','
        ? TokenKind.Comma
        : ch === ';'
        ? TokenKind.Semicolon
        : ch === '='
        ? TokenKind.Equals
        : ch === '\n'
        ? TokenKind.Eol
        : null;
    if (bracketType) {
      return new Token(bracketType, this.input.next(), location);
    }
    if (ch === '"') {
      return this.readString();
    }
    if (this.isDigit(ch)) {
      return this.readNumber();
    }
    if (this.isIdStart(ch)) {
      return this.readIdent();
    }
    if (this.isPunc(ch)) {
      return new Token(
        TokenKind.Punctuation,
        this.input.next() as any,
        location,
      );
    }
    if (this.isOpChar(ch)) {
      return new Token(TokenKind.Operator, this.input.next() as any, location);
    }
    this.input.croak(`Can't handle character: ${ch}`);
    return null;
  }

  protected skipUntilEol() {
    this.readWhile((ch) => ch !== '\n');
  }

  protected readIdent() {
    const location = this.input.location;
    const id = this.readWhile((ch) => this.isId(ch));
    let type = this.isKeyword(id)
      ? TokenKind.Keyword
      : ['true', 'false'].includes(id)
      ? TokenKind.Boolean
      : TokenKind.Identifier;
    if (id === '#region') {
      type = TokenKind.RegionStart;
      this.skipUntilEol();
    } else if (id === '#endregion') {
      type = TokenKind.RegionEnd;
      this.skipUntilEol();
    }
    return new Token(type, id, location);
  }

  protected readString() {
    let escaped = false;
    const location = this.input.location;
    let str = this.input.next();
    while (!this.input.eof()) {
      const ch = this.input.next();
      str += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        break;
      }
    }
    return new Token(TokenKind.String, str, location);
  }

  protected readNumber() {
    let hasDot = false;
    const number = this.readWhile((ch) => {
      if (ch === '.') {
        if (hasDot) return false;
        hasDot = true;
        return true;
      }
      return this.isDigit(ch);
    });
    return new Token(TokenKind.Number, number as any, this.input.location);
  }

  protected readWhile(test: (ch: string) => any) {
    let str = '';
    while (!this.input.eof() && test(this.input.peak())) {
      str += this.input.next();
    }
    return str;
  }

  protected isKeyword(identifier: string) {
    return TokenStream.keywords.has(identifier as any);
  }

  protected isDigit(ch: string) {
    return /[0-9]/i.test(ch);
  }

  protected isIdStart(ch: string) {
    return /[a-z_#]/i.test(ch);
  }

  protected isId(ch: string) {
    return this.isIdStart(ch) || /[0-9]/.test(ch);
  }

  protected isOpChar(ch: string) {
    return TokenStream.operators.has(ch as any);
  }

  protected isPunc(ch: string) {
    return TokenStream.punctuation.has(ch as any);
  }

  protected isWhitespace(ch: string) {
    return TokenStream.whitespace.has(ch as any);
  }
}
