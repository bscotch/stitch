import { c } from './tokens.categories.js';
import { createToken } from './tokens.lib.js';

const escapedCharacterTokens = [
  createToken({
    name: 'UnicodeCharacter',
    pattern: /\\u[0-9a-fA-F]{2,}/,
    start_chars_hint: ['\\'],
    categories: [c.StringLiteral, c.Substring],
  }),
  createToken({
    name: 'HexCharacter',
    pattern: /\\x[0-9a-fA-F]+/,
    start_chars_hint: ['\\'],
    categories: [c.StringLiteral, c.Substring],
  }),
  createToken({
    name: 'OctalCharacter',
    pattern: /\\[0-7]+/,
    start_chars_hint: ['\\'],
    categories: [c.StringLiteral, c.Substring],
  }),
  createToken({
    name: 'EscapedCharacter',
    pattern: /\\./,
    start_chars_hint: ['\\'],
    categories: [c.StringLiteral, c.Substring],
  }),
];

export const stringTokens = [
  ...escapedCharacterTokens,
  createToken({
    name: 'Character',
    pattern: /[^\n\r"]/,
    categories: [c.StringLiteral, c.Substring],
  }),
  createToken({
    name: 'StringEnd',
    pattern: /"/,
    categories: [c.Separators, c.StringLiteral],
    pop_mode: true,
  }),
];

export const multilineDoubleStringTokens = [
  createToken({
    name: 'MultilineDoubleStringCharacter',
    pattern: /[^"]/,
    line_breaks: true,
    categories: [
      c.StringLiteral,
      c.Substring,
      c.MultilineStringLiteral,
      c.DoubleQuoted,
    ],
  }),
  createToken({
    name: 'MultilineDoubleStringEnd',
    pattern: /"/,
    categories: [
      c.Separators,
      c.StringLiteral,
      c.MultilineStringLiteral,
      c.DoubleQuoted,
    ],
    pop_mode: true,
  }),
];

export const multilineSingleStringTokens = [
  createToken({
    name: 'MultilineSingleStringCharacter',
    pattern: /[^']/,
    line_breaks: true,
    categories: [
      c.StringLiteral,
      c.Substring,
      c.MultilineStringLiteral,
      c.SingleQuoted,
    ],
  }),
  createToken({
    name: 'MultilineSingleStringEnd',
    pattern: /'/,
    categories: [
      c.Separators,
      c.StringLiteral,
      c.MultilineStringLiteral,
      c.SingleQuoted,
    ],
    pop_mode: true,
  }),
];

export const templateTokens = [
  ...escapedCharacterTokens,
  createToken({
    name: 'TemplateInterpStart',
    pattern: /\{/,
    categories: [c.Separators, c.TemplateLiteral],
    push_mode: 'code',
  }),
  createToken({
    name: 'TemplateStringCharacter',
    pattern: /[^"\r\n]/,
    categories: [c.Substring, c.TemplateLiteral],
  }),
  createToken({
    name: 'TemplateStringEnd',
    pattern: /"/,
    categories: [c.Separators, c.TemplateLiteral],
    pop_mode: true,
  }),
];
