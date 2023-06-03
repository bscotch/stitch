import { createToken, Lexer, tokenListToObject } from './tokens.lib.js';

export const categories = [
  createToken({
    name: 'Keyword',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'Jsdoc',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'JsdocTag',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'Comment',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'Literal',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'BooleanLiteral',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'NumericLiteral',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'Substring',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'StringLiteral',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'MultilineStringLiteral',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'DoubleQuoted',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'SingleQuoted',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'TemplateLiteral',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'AssignmentOperator',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'BinaryOperator',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'UnaryPrefixOperator',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'UnaryPrefixOperatorNotPlusMinus',
    pattern: Lexer.NA,
  }),
  createToken({
    name: 'UnarySuffixOperator',
    pattern: Lexer.NA,
  }),
  // https://docs.oracle.com/javase/specs/jls/se11/html/jls-3.html#jls-3.11
  createToken({
    name: 'Separators',
    pattern: Lexer.NA,
  }),
];

export const c = tokenListToObject(categories);
