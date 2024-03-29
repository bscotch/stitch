import { c } from './tokens.categories.js';
import { createToken, Lexer } from './tokens.lib.js';
import { identifier, numericLiterals } from './tokens.shared.js';

export const codeTokens = [
  //#region Whitespace and comments

  // Lines can end with a "\" character, which is required
  // by GML in multi-line macros but not needed anywhere else.
  // Outside of that, "\" is only used in strings as an escape character.
  // Stitch doesn't allow macros to be invalid standalone code anyway,
  // so if we just treat "\" characters (outside of strings) as whitespace
  // and ignore them we can treat macros like variables.
  createToken({
    name: 'WhiteSpace',
    pattern: /[ \t\n\r\\]+/,
    line_breaks: true,
    group: Lexer.SKIPPED,
  }),

  // Add separate parser modes for comments
  createToken({
    name: 'JsdocGmlLine',
    pattern: /\/\/\/.*/,
    start_chars_hint: ['/'],
    line_breaks: false,
    categories: [c.Jsdoc],
  }),
  createToken({
    name: 'JsdocJs',
    pattern: /\/\*\*([\r\n]|.)*?\*\//,
    start_chars_hint: ['/'],
    line_breaks: true,
    categories: [c.Jsdoc],
  }),
  createToken({
    name: 'SingleLineComment',
    pattern: /\/\/[^\r\n]*/,
    group: Lexer.SKIPPED,
    start_chars_hint: ['/'],
    categories: [c.Comment],
  }),
  createToken({
    name: 'MultiLineComment',
    pattern: /(?<!\\)\/\*([\r\n]|.)*?(?<!\\)\*\//,
    group: Lexer.SKIPPED,
    line_breaks: true,
    start_chars_hint: ['/'],
    categories: [c.Comment],
  }),
  // Note: Sometimes multiline comments are started and then comment out the rest of the file, and are not terminated.
  createToken({
    name: 'MultiLineCommentNotTerminated',
    pattern: /(?<!\\)\/\*([\r\n]|.)*/,
    group: Lexer.SKIPPED,
    line_breaks: true,
    start_chars_hint: ['/'],
    categories: [c.Comment],
  }),
  //#endregion

  //#region Strings (require multiple modes)
  createToken({
    name: 'StringStart',
    pattern: /"/,
    start_chars_hint: ['"'],
    categories: [c.Separators, c.StringLiteral],
    push_mode: 'string',
  }),
  createToken({
    name: 'TemplateStart',
    pattern: /\$"/,
    start_chars_hint: ['$'],
    categories: [c.Separators, c.StringLiteral],
    push_mode: 'template',
  }),
  createToken({
    name: 'MultilineDoubleStringStart',
    pattern: /@"/,
    start_chars_hint: ['@'],
    categories: [
      c.Separators,
      c.StringLiteral,
      c.MultilineStringLiteral,
      c.DoubleQuoted,
    ],
    push_mode: 'multilineDoubleString',
  }),
  createToken({
    name: 'MultilineSingleStringStart',
    pattern: /@'/,
    start_chars_hint: ['@'],
    categories: [
      c.Separators,
      c.StringLiteral,
      c.MultilineStringLiteral,
      c.SingleQuoted,
    ],
    push_mode: 'multilineSingleString',
  }),
  //#endregion

  //#region Named Literals
  createToken({
    name: 'NullPointer',
    pattern: /\bpointer_null\b/,
    categories: [c.Keyword, c.PointerLiteral],
  }),
  createToken({
    name: 'InvalidPointer',
    pattern: /\bpointer_invalid\b/,
    categories: [c.Keyword, c.PointerLiteral],
  }),
  createToken({
    name: 'Undefined',
    pattern: /\bundefined\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'Infinity',
    pattern: /\binfinity\b/,
    categories: [c.Keyword, c.NumericLiteral],
  }),
  createToken({
    name: 'Pi',
    pattern: /\bpi\b/,
    categories: [c.Keyword, c.NumericLiteral],
  }),
  createToken({
    name: 'NaN',
    pattern: /\bNaN\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'True',
    pattern: /\btrue\b/,
    categories: [c.Keyword, c.BooleanLiteral],
  }),
  createToken({
    name: 'False',
    pattern: /\bfalse\b/,
    categories: [c.Keyword, c.BooleanLiteral],
  }),
  //#endregion

  //#region Keywords
  createToken({
    name: 'Begin',
    pattern: /\bbegin\b/,
    categories: [c.Keyword, c.Separators],
    push_mode: 'code',
  }),
  createToken({
    name: 'End',
    pattern: /\bend\b/,
    categories: [c.Keyword, c.Separators],
    pop_mode: true,
  }),
  createToken({ name: 'If', pattern: /\bif\b/, categories: [c.Keyword] }),
  createToken({ name: 'Then', pattern: /\bthen\b/, categories: [c.Keyword] }),
  createToken({ name: 'Else', pattern: /\belse\b/, categories: [c.Keyword] }),
  createToken({ name: 'While', pattern: /\bwhile\b/, categories: [c.Keyword] }),
  createToken({ name: 'Do', pattern: /\bdo\b/, categories: [c.Keyword] }),
  createToken({ name: 'For', pattern: /\bfor\b/, categories: [c.Keyword] }),
  createToken({ name: 'Break', pattern: /\bbreak\b/, categories: [c.Keyword] }),
  createToken({
    name: 'Continue',
    pattern: /\bcontinue\b/,
    categories: [c.Keyword],
  }),
  createToken({ name: 'With', pattern: /\bwith\b/, categories: [c.Keyword] }),
  createToken({ name: 'Until', pattern: /\buntil\b/, categories: [c.Keyword] }),
  createToken({
    name: 'Repeat',
    pattern: /\brepeat\b/,
    categories: [c.Keyword],
  }),
  createToken({ name: 'Exit', pattern: /\bexit\b/, categories: [c.Keyword] }),
  createToken({
    name: 'And',
    pattern: /\band\b/,
    categories: [c.Keyword, c.BinaryOperator],
  }),
  createToken({
    name: 'Or',
    pattern: /\bor\b/,
    categories: [c.Keyword, c.BinaryOperator],
  }),
  createToken({
    name: 'Xor',
    pattern: /\bxor\b/,
    categories: [c.Keyword, c.BinaryOperator],
  }),
  createToken({
    name: 'Not',
    pattern: /\bnot\b/,
    categories: [
      c.Keyword,
      c.UnaryPrefixOperator,
      c.UnaryPrefixOperatorNotPlusMinus,
    ],
  }),
  createToken({
    name: 'Return',
    pattern: /\breturn\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'Modulo',
    pattern: /\bmod\b/,
    categories: [c.Keyword, c.BinaryOperator],
  }),
  createToken({
    name: 'Div',
    pattern: /\bdiv\b/,
    categories: [c.Keyword, c.BinaryOperator],
  }),
  createToken({
    name: 'Switch',
    pattern: /\bswitch\b/,
    categories: [c.Keyword],
  }),
  createToken({ name: 'Case', pattern: /\bcase\b/, categories: [c.Keyword] }),
  createToken({
    name: 'Default',
    pattern: /\bdefault\b/,
    categories: [c.Keyword],
  }),
  createToken({ name: 'Var', pattern: /\bvar\b/, categories: [c.Keyword] }),
  createToken({
    name: 'Global',
    pattern: /\bglobal\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'GlobalVar',
    pattern: /\bglobalvar\b/,
    categories: [c.Keyword],
  }),
  createToken({ name: 'Enum', pattern: /\benum\b/, categories: [c.Keyword] }),
  createToken({
    name: 'Function',
    pattern: /\bfunction\b/,
    categories: [c.Keyword],
  }),
  createToken({ name: 'Try', pattern: /\btry\b/, categories: [c.Keyword] }),
  createToken({ name: 'Catch', pattern: /\bcatch\b/, categories: [c.Keyword] }),
  createToken({
    name: 'Finally',
    pattern: /\bfinally\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'Static',
    pattern: /\bstatic\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'New',
    pattern: /\bnew\b/,
    categories: [c.Keyword],
  }),
  createToken({
    name: 'Delete',
    pattern: /\bdelete\b/,
    categories: [
      c.Keyword,
      c.UnaryPrefixOperator,
      c.UnaryPrefixOperatorNotPlusMinus,
    ],
  }),
  createToken({
    name: 'Constructor',
    pattern: /\bconstructor\b/,
    categories: [c.Keyword],
  }),
  // TODO: Add separate parser modes for macros
  createToken({ name: 'Macro', pattern: /#macro\b/, categories: [c.Keyword] }),
  // TODO: Add separate parser modes for regions
  createToken({
    name: 'Region',
    pattern: /#region\b[^\n]*/,
    group: Lexer.SKIPPED,
    categories: [c.Keyword, c.Comment],
  }),
  createToken({
    name: 'EndRegion',
    pattern: /#endregion[^\n]*\b/,
    group: Lexer.SKIPPED,
    categories: [c.Keyword, c.Comment],
  }),
  createToken({ name: 'Self', pattern: /\bself\b/, categories: [c.Keyword] }),
  createToken({ name: 'Other', pattern: /\bother\b/, categories: [c.Keyword] }),
  createToken({ name: 'Noone', pattern: /\bnoone\b/, categories: [c.Keyword] }),
  createToken({ name: 'All', pattern: /\ball\b/, categories: [c.Keyword] }),
  //#endregion

  //#region Operators and punctuation
  // 3 characters
  createToken({
    name: 'NullishAssign',
    pattern: /\?\?=/,
    categories: [c.AssignmentOperator],
  }),
  // 2 characters
  createToken({
    name: 'PlusAssign',
    pattern: /\+=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'MinusAssign',
    pattern: /-=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'MultiplyAssign',
    pattern: /\*=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'DivideAssign',
    pattern: /\/=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'ModuloAssign',
    pattern: /%=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'BitwiseAndAssign',
    pattern: /&=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'BitwiseOrAssign',
    pattern: /\|=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'BitwiseXorAssign',
    pattern: /\^=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'Nullish',
    pattern: /\?\?/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'Equals',
    pattern: /==/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'NotEqual',
    pattern: /!=/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'Increment',
    pattern: /\+\+/,
    categories: [
      c.UnaryPrefixOperator,
      c.UnarySuffixOperator,
      c.UnaryPrefixOperatorNotPlusMinus,
    ],
  }),
  createToken({
    name: 'Decrement',
    pattern: /--/,
    categories: [
      c.UnaryPrefixOperator,
      c.UnarySuffixOperator,
      c.UnaryPrefixOperatorNotPlusMinus,
    ],
  }),
  createToken({
    name: 'LessThanOrEqual',
    pattern: /<=/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'GreaterThanOrEqual',
    pattern: />=/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'ShiftLeft',
    pattern: /<</,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'ShiftRight',
    pattern: />>/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'StructAccessorStart',
    pattern: /\[\$/,
    categories: [c.Separators],
  }),
  createToken({
    name: 'DsMapAccessorStart',
    pattern: /\[\?/,
    categories: [c.Separators],
  }),
  createToken({
    name: 'DsListAccessorStart',
    pattern: /\[\|/,
    categories: [c.Separators],
  }),
  createToken({
    name: 'DsGridAccessorStart',
    pattern: /\[#/,
    categories: [c.Separators],
  }),
  createToken({
    name: 'ArrayMutateAccessorStart',
    pattern: /\[@/,
    categories: [c.Separators],
  }),
  createToken({ name: 'And', pattern: /&&/, categories: [c.BinaryOperator] }),
  createToken({ name: 'Or', pattern: /\|\|/, categories: [c.BinaryOperator] }),
  createToken({ name: 'Xor', pattern: /\^\^/, categories: [c.BinaryOperator] }),
  // 1 character
  createToken({
    name: 'Plus',
    pattern: /\+/,
    categories: [c.BinaryOperator, c.UnaryPrefixOperator],
  }),
  createToken({
    name: 'Minus',
    pattern: /-/,
    categories: [c.BinaryOperator, c.UnaryPrefixOperator],
  }),
  createToken({
    name: 'Multiply',
    pattern: /\*/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'Divide',
    pattern: /\//,
    categories: [c.BinaryOperator],
  }),
  createToken({ name: 'Modulo', pattern: /%/, categories: [c.BinaryOperator] }),
  createToken({
    name: 'Assign',
    pattern: /=/,
    categories: [c.AssignmentOperator],
  }),
  createToken({
    name: 'Not',
    pattern: /!/,
    categories: [c.UnaryPrefixOperator, c.UnaryPrefixOperatorNotPlusMinus],
  }),
  createToken({
    name: 'LessThan',
    pattern: /</,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'GreaterThan',
    pattern: />/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'BitwiseAnd',
    pattern: /&/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'BitwiseOr',
    pattern: /\|/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'BitwiseXor',
    pattern: /\^/,
    categories: [c.BinaryOperator],
  }),
  createToken({
    name: 'BitwiseNot',
    pattern: /~/,
    categories: [c.UnaryPrefixOperator, c.UnaryPrefixOperatorNotPlusMinus],
  }),
  createToken({ name: 'Comma', pattern: /,/, categories: [c.Separators] }),
  createToken({ name: 'Semicolon', pattern: /;/, categories: [c.Separators] }),
  createToken({ name: 'Colon', pattern: /:/ }),
  createToken({ name: 'QuestionMark', pattern: /\?/ }),
  createToken({
    name: 'StartParen',
    pattern: /\(/,
    categories: [c.Separators],
  }),
  createToken({ name: 'EndParen', pattern: /\)/, categories: [c.Separators] }),
  createToken({
    name: 'StartBracket',
    pattern: /\[/,
    categories: [c.Separators],
  }),
  createToken({
    name: 'EndBracket',
    pattern: /\]/,
    categories: [c.Separators],
  }),
  createToken({
    name: 'StartBrace',
    pattern: /\{/,
    categories: [c.Separators],
    push_mode: 'code',
  }),
  createToken({
    name: 'EndBrace',
    pattern: /\}/,
    categories: [c.Separators],
    pop_mode: true,
  }),
  createToken({ name: 'Escape', pattern: /\\/, categories: [c.Separators] }),
  //#endregion

  //#region Literals
  ...numericLiterals,

  // Dot-accessor needs to be late so it doesn't conflict with decimals
  createToken({ name: 'Dot', pattern: /\./, categories: [c.Separators] }),

  //#region Identifiers
  identifier,
];
