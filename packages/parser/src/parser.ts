import { CharacterStream } from './parser.character.js';
import { Token, TokenStream } from './parser.token.js';
import {
  ConstructorDeclaration,
  EnumDeclaration,
  EnumEntry,
  FunctionDeclaration,
  FunctionParameter,
  GlobalVarDeclaration,
  Identifier,
  MacroDeclaration,
  Node,
  SyntaxKind,
  TokenKind,
} from './parser.types.js';

/**
 * A basic parser for GML scripts and objects, with
 * a focus on global functions, macros, and variables.
 */
export class Parser {
  readonly input: TokenStream;
  readonly functions: Map<
    string,
    FunctionDeclaration | ConstructorDeclaration
  > = new Map();
  readonly macros: Map<string, MacroDeclaration> = new Map();
  readonly identifiers: Map<string, Identifier[]> = new Map();
  readonly enums: Map<string, EnumDeclaration> = new Map();
  readonly globalvars: Map<string, GlobalVarDeclaration> = new Map();

  constructor(
    protected code: string,
    readonly options?: { filePath?: string },
  ) {
    this.input = new TokenStream(new CharacterStream(code));
  }

  get end() {
    return this.code.length;
  }

  parse(): void {
    const token = this.input.peek();
    if (!token) {
      return;
    }
    // Short-circuit eval
    const next =
      this.parseFunction() ||
      this.parseMacro() ||
      this.parseEnum() ||
      this.parseGlobalVarDefinition() ||
      this.parseIdentifier();
    if (!next) {
      if (
        [
          TokenKind.LeftBrace,
          TokenKind.LeftBracket,
          TokenKind.LeftParen,
        ].includes(token.type)
      ) {
        this.skipStatement();
      } else {
        this.input.next();
      }
    }

    return this.parse();
  }

  protected parseGlobalVarDefinition(): GlobalVarDeclaration | null {
    if (!this.skipNextIfIs(TokenKind.Keyword, 'globalvar')) {
      return null;
    }
    this.assertNextIs(TokenKind.Identifier);
    const nameToken = this.input.next()!;
    const declaration: GlobalVarDeclaration = createNode(
      SyntaxKind.GlobalVarDeclaration,
      nameToken,
    );
    this.globalvars.set(declaration.name, declaration);
    while (this.nextIs(TokenKind.Comma) && this.input.next()) {
      const anotherGlobal = this.input.next();
      if (!anotherGlobal) {
        break;
      }
      const anotherDeclaration: GlobalVarDeclaration = createNode(
        SyntaxKind.GlobalVarDeclaration,
        anotherGlobal,
      );
      this.globalvars.set(anotherDeclaration.name, anotherDeclaration);
    }
    return declaration;
  }

  protected parseIdentifier(): Identifier | null {
    if (!this.nextIs(TokenKind.Identifier)) {
      return null;
    }
    const idToken = this.input.next()!;
    const identifier = createNode<Identifier>(SyntaxKind.Identifier, idToken);
    this.identifiers.set(
      identifier.name,
      this.identifiers.get(identifier.name) || [],
    );
    this.identifiers.get(identifier.name)!.push(identifier);
    return identifier;
  }

  protected parseEnum(): EnumDeclaration | null {
    if (!this.nextIs(TokenKind.Keyword, 'enum')) {
      return null;
    }
    // consume the 'enum' keyword
    this.skipNext();
    this.assertNextIs(TokenKind.Identifier);
    const nameToken = this.input.next()!;
    this.assertNextIs(TokenKind.LeftBrace).skipNext();
    const values: Map<string, EnumEntry> = new Map();
    while (true) {
      if (
        this.skipNextIfIs(TokenKind.RightBrace) ||
        !this.nextIs(TokenKind.Identifier)
      ) {
        break;
      }
      const entryToken = this.input.next()!;
      values.set(
        entryToken.value,
        createNode(SyntaxKind.EnumEntry, entryToken),
      );
      if (this.skipNextIfIs(TokenKind.Equals)) {
        // Consume the value it's set to
        this.skipStatement();
      }
      this.skipNextIfIs(TokenKind.Comma);
    }
    const enumDeclaration: EnumDeclaration = {
      ...createNode(SyntaxKind.EnumDeclaration, nameToken),
      info: values,
    };
    this.enums.set(enumDeclaration.name, enumDeclaration);
    return enumDeclaration;
  }

  protected parseMacro(): MacroDeclaration | null {
    if (!this.skipNextIfIs(TokenKind.Keyword, '#macro')) {
      return null;
    }
    this.assertNextIs(TokenKind.Identifier);
    const nameToken = this.input.next()!;
    // Value can span multiple lines, if the line ends with a `\`
    let lastMacroLine = nameToken.location.line;
    const macroValueTokens: Token[] = [];
    while (true) {
      const peek = this.input.peek();
      if (!peek || peek.location.line > lastMacroLine) {
        break;
      }
      macroValueTokens.push(this.input.next()!);
      if (peek.type === TokenKind.Punctuation && peek.value === '\\') {
        lastMacroLine++;
      }
    }

    const macro: MacroDeclaration = {
      ...createNode(SyntaxKind.MacroDeclaration, nameToken),
      info: macroValueTokens.map((t) => t.value).join(' '),
    };
    this.macros.set(macro.name, macro);
    return macro;
  }

  protected parseFunction(
    ignore = false,
  ): FunctionDeclaration | ConstructorDeclaration | null {
    if (!this.skipNextIfIs(TokenKind.Keyword, 'function')) {
      return null;
    }
    const params: FunctionParameter[] = [];
    const func = createNode<FunctionDeclaration | ConstructorDeclaration>(
      SyntaxKind.FunctionDeclaration,
      this.input.peek()!,
      params,
    );
    func.name = null; // Default to for anonymous functions
    if (this.nextIs(TokenKind.Identifier)) {
      const nameToken = this.input.next()!;
      func.name = nameToken.value;
    }
    this.assertNextIs(TokenKind.LeftParen).skipNext();
    let param = this.nextParam();
    while (param) {
      params.push(param);
      param = this.nextParam();
    }
    this.assertNextIs(TokenKind.RightParen).skipNext();
    if (this.skipNextIfIs(TokenKind.Punctuation, ':')) {
      // Then we're extending another constructor
      func.kind = SyntaxKind.ConstructorDeclaration;
      this.skipStatement();
    } else if (this.skipNextIfIs(TokenKind.Keyword, 'constructor')) {
      func.kind = SyntaxKind.ConstructorDeclaration;
    }

    // Skip the body for now
    this.skipStatement();
    if (func.name && !ignore) {
      this.functions.set(func.name, func);
    }
    return func;
  }

  protected nextParam(): FunctionParameter | null {
    if (!this.nextIs(TokenKind.Identifier)) {
      return null;
    }
    // Then consume the identifier
    const nameToken = this.input.next()!;
    let optional = false;
    if (this.skipNextIfIs(TokenKind.Equals)) {
      // Skip the default value
      optional = true;
      this.skipStatement();
    }
    this.skipNextIfIs(TokenKind.Comma);
    return createNode<FunctionParameter>(
      SyntaxKind.FunctionParameter,
      nameToken,
      { optional },
    );
  }

  protected skipStatement() {
    let depth = 0;
    while (true) {
      const next = this.input.peek();
      if (!next) {
        return;
      }
      // Consume any macros, identifiers, and functions
      if (
        this.parseMacro() ||
        this.parseEnum() ||
        this.parseGlobalVarDefinition() ||
        this.parseIdentifier() ||
        this.parseFunction(true)
      ) {
        continue;
      }
      if (
        [
          TokenKind.LeftBrace,
          TokenKind.LeftBracket,
          TokenKind.LeftParen,
        ].includes(next.type)
      ) {
        depth++;
        this.input.next();
      } else if (
        depth &&
        [
          TokenKind.RightBrace,
          TokenKind.RightBracket,
          TokenKind.RightParen,
        ].includes(next.type)
      ) {
        depth--;
        this.input.next();
        if (!depth) {
          return;
        }
      } else if (depth) {
        // Skip the token
        this.input.next();
      } else if (next.type === TokenKind.Semicolon) {
        // Consume the semi-colon, since it's part of the statement
        this.input.next();
        return;
      } else if (
        [
          TokenKind.RightBrace,
          TokenKind.RightBracket,
          TokenKind.RightParen,
          TokenKind.Comma,
        ].includes(next.type)
      ) {
        // Then we should be done with the statement but don't want
        // to consume the token
        return;
      } else {
        this.input.next();
      }
    }
  }

  protected skipNext(): this {
    this.input.next();
    return this;
  }
  protected nextIs(kind: TokenKind, value?: string): boolean {
    const peek = this.input.peek();
    return peek?.type === kind && (!value || value === peek?.value);
  }
  /**
   * Skips the next token if it matches the given kind and value.
   * Returns `true` if the next token matched and was skipped, else
   * `false`.
   */
  protected skipNextIfIs(kind: TokenKind, value?: string): boolean {
    if (this.nextIs(kind, value)) {
      this.skipNext();
      return true;
    }
    return false;
  }

  public assert(condition: any, message: string): asserts condition {
    if (!condition) {
      throw new ParseError(message, this);
    }
  }

  protected assertNextIs(type: TokenKind, value?: string): this {
    this.assert(
      this.nextIs(type),
      `Expected a ${type} but got ${this.input.peek()?.type}`,
    );
    return this;
  }
}

function createNode<T extends Node>(
  kind: T['kind'],
  token: Token,
  info: T['info'] = undefined,
): T {
  return {
    kind,
    name: token.value,
    range: token.range,
    position: token.position,
    info,
    children: [],
  } as any;
}

export class ParseError extends Error {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, parser: Parser) {
    const loc = parser.input.peek()?.location;
    const filePath = parser.options?.filePath;
    let fullpath = filePath ? filePath + ':' : '';
    if (loc) {
      fullpath += `${loc.line}:${loc.col}`;
    }
    super(message + `\n${fullpath}`);
    this.name = 'ParseError';
    Error.captureStackTrace(this, parser.assert);
  }
}
