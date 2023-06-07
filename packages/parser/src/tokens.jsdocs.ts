import { c } from './tokens.categories.js';
import { createToken } from './tokens.lib.js';
import { horizontalWhitespace, numericLiterals } from './tokens.shared.js';

const jsdocLineTokens = [
  horizontalWhitespace,
  createToken({
    name: 'JsdocFunctionTag',
    pattern: /@func(tion)?\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocDescriptionTag',
    pattern: /@desc(ription)?\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocParamTag',
    pattern: /@(param(eter)?|@arg(ument)?)\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocReturnTag',
    pattern: /@returns?\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocPureTag',
    pattern: /@pure\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocIgnoreTag',
    pattern: /@ignore\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocDeprecatedTag',
    pattern: /@deprecated\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocSelfTag',
    pattern: /@(context|self)\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocTypeTag',
    pattern: /@type\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocUnknownTag',
    pattern: /@[a-zA-Z_]+\b/,
    start_chars_hint: ['@'],
    categories: [c.JsdocTag],
  }),
  createToken({
    name: 'JsdocStartBrace',
    pattern: /\{/,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocEndBrace',
    pattern: /\}/,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocStartAngleBracket',
    pattern: /</,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocEndAngleBracket',
    pattern: />/,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocStartSquareBracket',
    pattern: /\[/,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocEndSquareBracket',
    pattern: /\]/,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocDot',
    pattern: /\./,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocPipe',
    pattern: /\|/,
    categories: [c.Separators, c.Jsdoc],
  }),
  createToken({
    name: 'JsdocEquals',
    pattern: /=/,
    categories: [c.Separators, c.Jsdoc],
  }),
  ...numericLiterals,
  createToken({
    name: 'JsdocString',
    pattern: /"[^"]*"/,
    categories: [c.Literal],
  }),
  createToken({
    name: 'JsdocIdentifier',
    pattern: /\b[a-zA-Z_][a-zA-Z0-9_.]*\b/,
    categories: [c.Jsdoc],
  }),
];

export const jsdocsJsTokens = [
  ...jsdocLineTokens,
  createToken({
    name: 'JsdocJsEnd',
    pattern: /(\r?\n)?\s*\*\//,
    line_breaks: true,
    pop_mode: true,
  }),
  createToken({
    name: 'JsdocJsLineStart',
    pattern: /\r?\n\s*(\*\s+)?/,
    line_breaks: true,
    categories: [c.Separators],
  }),
  createToken({
    name: 'JsdocJsDescription',
    pattern: /[^\r\n]+/,
    categories: [c.Jsdoc],
  }),
];

export const jsdocsGmlTokens = [
  ...jsdocLineTokens,
  createToken({
    name: 'JsdocGmlLineEnd',
    pattern: /\r?\n/,
    categories: [c.Separators],
    line_breaks: true,
    pop_mode: true,
  }),
  createToken({
    name: 'JsdocJsDescription',
    pattern: /.*[^\r\n]/,
    line_breaks: true,
    categories: [c.Jsdoc],
  }),
];
