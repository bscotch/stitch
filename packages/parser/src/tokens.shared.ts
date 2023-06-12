import { c } from './tokens.categories.js';
import { Lexer, createToken } from './tokens.lib.js';

export const identifier = createToken({
  name: 'Identifier',
  pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/,
});

export const horizontalWhitespace = createToken({
  name: 'WhiteSpace',
  pattern: /[ \t]+/,
  line_breaks: true,
  group: Lexer.SKIPPED,
});

export const numericLiterals = [
  createToken({
    name: 'Hex',
    pattern: /(0x|\$)[\da-fA-F_]+/,
    categories: [c.NumericLiteral],
  }),
  createToken({
    name: 'Binary',
    pattern: /0b[01_]+/,
    categories: [c.NumericLiteral],
  }),
  createToken({
    name: 'Real',
    pattern: /(\d[\d_]*(\.\d[\d_]*)?)|\.\d[\d_]*/,
    categories: [c.NumericLiteral],
  }),
];
