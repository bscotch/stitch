/**
 * GameMaker Language (GML) has similar grammar and syntax to JavaScript ES3 but does have significant differences. Treat GML as if it is JavaScript, but with the following differences:
 *
 * - GML uses `self` instead of `this`
 * - GML calls objects "structs"
 * - GML calls numbers "reals"
 * - GML uses `pointer_null` instead of `null`
 * - GML uses the constant `infinity` (all lower-case) instead of capitalized `Infinity`
 * - GML has a `typeof()` function instead of a `typeof` unary operator
 * - GML has an `instanceof()` function instead of the `instanceof` binary operator
 * - GML JSDoc comments use single-line comments indicated by `\\\`
 * - GML names can only include alphanumeric and underscore characters, though the first character must not be a number.
 * - Instead of classes, GML uses "constructor functions" that insert the `constructor` keyword between the parameters and body: `function MyConstructorFunction () constructor { ...}`
 * - GML strings can only be wrapped in double-quote characters
 * - GML uses `var` but does not have `let` nor `const`
 * - GML has "macros", defined with the keyword `#macro`: `#macro my_macro "some_expression"`. Macros can be defined over multiple lines by ending each line with a `\` character. At compile time, macro references are replaced with their values as if they were copy-pasted.
 * - GML arrays, strings, and functions have no internal functions, so the `.`-accessor cannot be used on them. For example, to get the length of an array you'd use `array_length(the_array)` instead of accessing a `length` property.
 * - To access a struct property, GML uses `[$ the_field]` instead of `[the_field]`. Struct properties can also be accessed with the `.` operator, just like a JavaScript object.
 * - GML has a few other data types that also use modified accessors:
 *   - `ds_list` indexes are accessed with `[| the_index]`
 *   - `ds_map` fields are accessed with `[? the_field]`
 *   - `ds_grid` coordinates are accessed with `[# x_pos, y_pos]`
 *
 *
 * In addition to the differences listed above, GML has some special features:
 *
 * - The XOR operator: `^^`
 * - Binary literals can be written by using `0b` as a prefix. For example, `0b10` represents decimal 2 in binary.
 * - Hexadecimal literals can be written by using `0x` or `$` as a prefix. For example, `$001122`
 * - The nullish coalescing operator `??`
 * - Combined assignment operators:
 *   - `??=`
 *   - `|=`
 *   - `&=`
 *   - `^=`
 *   - `-=`
 *   - `+=`
 *   - `*=`
 *   - `/=`
 * - Code-folding regions can be created using the `#region` and `#endregion` keywords
 *
 *
 * The following comprehensive list includes all of the GML keywords:
 *
 * - `begin` (equivalent to `{`)
 * - `end` (equivalent to `}`)
 * - `if`
 * - `then`
 * - `else`
 * - `while`
 * - `do`
 * - `for`
 * - `break`
 * - `continue`
 * - `with`
 * - `until`
 * - `repeat`
 * - `exit`
 * - `and` (equivalent to `&&`)
 * - `or` (equivalent to `||`)
 * - `xor` (equivalent to `^^`)
 * - `not` (equivalent to `!`)
 * - `return`
 * - `mod`
 * - `div`
 * - `switch`
 * - `case`
 * - `default`
 * - `var`
 * - `global` (a struct)
 * - `globalvar` (works like `var`)
 * - `enum`
 * - `function`
 * - `try`
 * - `catch`
 * - `finally`
 * - `throw`
 * - `static`
 * - `new`
 * - `delete`
 * - `constructor`
 * - `#macro`
 * - `#region`
 * - `#endregion`
 *
 * And these are the core GML constants:
 *
 * - `true`
 * - `false`
 * - `pi`
 * - `NaN`
 * - `infinity`
 * - `self`
 * - `other`
 * - `noone`
 * - `all`
 * - `global`
 * - `undefined`
 * - `pointer_invalid`
 * - `pointer_null`
 */

import { createToken, Lexer } from 'chevrotain';

export const tokens = [
  //#region Whitespace and comments
  createToken({
    name: 'WhiteSpace',
    pattern: /[ \t\n\r]+/,
    group: Lexer.SKIPPED,
  }),
  createToken({
    name: 'Comment',
    pattern: /\/\/[^\n]*/,
    group: Lexer.SKIPPED,
    start_chars_hint: ['/'],
  }),
  createToken({
    name: 'MultiLineComment',
    pattern: /(?<!\\)\/\*([\r\n]|.)*?(?<!\\)\*\//,
    group: Lexer.SKIPPED,
    line_breaks: true,
    start_chars_hint: ['/'],
  }),
  //#endregion

  //#region Strings
  createToken({
    name: 'StringLiteral',
    pattern: /(?<!\\)"[^\r\n]*?(?<!\\)"/,
    start_chars_hint: ['"'],
    line_breaks: false,
  }),
  //#endregion

  //#region Named Literals
  createToken({ name: 'NullPointer', pattern: /\bpointer_null\b/ }),
  createToken({ name: 'InvalidPointer', pattern: /\bpointer_invalid\b/ }),
  createToken({ name: 'Undefined', pattern: /\bundefined\b/ }),
  createToken({ name: 'Infinity', pattern: /\binfinity\b/ }),
  createToken({ name: 'Pi', pattern: /\bpi\b/ }),
  createToken({ name: 'NaN', pattern: /\bNaN\b/ }),
  createToken({ name: 'True', pattern: /\btrue\b/ }),
  createToken({ name: 'False', pattern: /\bfalse\b/ }),
  //#endregion

  //#region Keywords
  createToken({ name: 'Begin', pattern: /\bbegin\b/ }),
  createToken({ name: 'End', pattern: /\bend\b/ }),
  createToken({ name: 'If', pattern: /\bif\b/ }),
  createToken({ name: 'Then', pattern: /\bthen\b/ }),
  createToken({ name: 'Else', pattern: /\belse\b/ }),
  createToken({ name: 'While', pattern: /\bwhile\b/ }),
  createToken({ name: 'Do', pattern: /\bdo\b/ }),
  createToken({ name: 'For', pattern: /\bfor\b/ }),
  createToken({ name: 'Break', pattern: /\bbreak\b/ }),
  createToken({ name: 'Continue', pattern: /\bcontinue\b/ }),
  createToken({ name: 'With', pattern: /\bwith\b/ }),
  createToken({ name: 'Until', pattern: /\buntil\b/ }),
  createToken({ name: 'Repeat', pattern: /\brepeat\b/ }),
  createToken({ name: 'Exit', pattern: /\bexit\b/ }),
  createToken({ name: 'And', pattern: /\band\b/ }),
  createToken({ name: 'Or', pattern: /\bor\b/ }),
  createToken({ name: 'Xor', pattern: /\bxor\b/ }),
  createToken({ name: 'Not', pattern: /\bnot\b/ }),
  createToken({ name: 'Return', pattern: /\breturn\b/ }),
  createToken({ name: 'Modulo', pattern: /\bmod\b/ }),
  createToken({ name: 'Div', pattern: /\bdiv\b/ }),
  createToken({ name: 'Switch', pattern: /\bswitch\b/ }),
  createToken({ name: 'Case', pattern: /\bcase\b/ }),
  createToken({ name: 'Default', pattern: /\bdefault\b/ }),
  createToken({ name: 'Var', pattern: /\bvar\b/ }),
  createToken({ name: 'Global', pattern: /\bglobal\b/ }),
  createToken({ name: 'GlobalVar', pattern: /\bglobalvar\b/ }),
  createToken({ name: 'Enum', pattern: /\benum\b/ }),
  createToken({ name: 'Function', pattern: /\bfunction\b/ }),
  createToken({ name: 'Try', pattern: /\btry\b/ }),
  createToken({ name: 'Catch', pattern: /\bcatch\b/ }),
  createToken({ name: 'Finally', pattern: /\bfinally\b/ }),
  createToken({ name: 'Throw', pattern: /\bthrow\b/ }),
  createToken({ name: 'Static', pattern: /\bstatic\b/ }),
  createToken({ name: 'New', pattern: /\bnew\b/ }),
  createToken({ name: 'Delete', pattern: /\bdelete\b/ }),
  createToken({ name: 'Constructor', pattern: /\bconstructor\b/ }),
  createToken({ name: 'Macro', pattern: /#macro\b/ }),
  createToken({ name: 'Region', pattern: /#region\b/ }),
  createToken({ name: 'EndRegion', pattern: /#endregion\b/ }),
  createToken({ name: 'Self', pattern: /\bself\b/ }),
  createToken({ name: 'Other', pattern: /\bother\b/ }),
  createToken({ name: 'Noone', pattern: /\bnoone\b/ }),
  createToken({ name: 'All', pattern: /\ball\b/ }),
  //#endregion

  //#region Operators and punctuation
  // 3 characters
  createToken({ name: 'NullishAssign', pattern: /\?\?=/ }),
  // 2 characters
  createToken({ name: 'PlusAssign', pattern: /\+=/ }),
  createToken({ name: 'MinusAssign', pattern: /-=/ }),
  createToken({ name: 'MultiplyAssign', pattern: /\*=/ }),
  createToken({ name: 'DivideAssign', pattern: /\/=/ }),
  createToken({ name: 'ModuloAssign', pattern: /%=/ }),
  createToken({ name: 'BitwiseAndAssign', pattern: /&=/ }),
  createToken({ name: 'BitwiseOrAssign', pattern: /\|=/ }),
  createToken({ name: 'BitwiseXorAssign', pattern: /\^=/ }),
  createToken({ name: 'Nullish', pattern: /\?\?/ }),
  createToken({ name: 'Equal', pattern: /==/ }),
  createToken({ name: 'NotEqual', pattern: /!=/ }),
  createToken({ name: 'Increment', pattern: /\+\+/ }),
  createToken({ name: 'Decrement', pattern: /--/ }),
  createToken({ name: 'LessThanOrEqual', pattern: /<=/ }),
  createToken({ name: 'GreaterThanOrEqual', pattern: />=/ }),
  createToken({ name: 'ShiftLeft', pattern: /<</ }),
  createToken({ name: 'ShiftRight', pattern: />>/ }),
  createToken({ name: 'StructAccessorStart', pattern: /\[\$/ }),
  createToken({ name: 'DsMapAccessorStart', pattern: /\[\?/ }),
  createToken({ name: 'DsListAccessorStart', pattern: /\[\|/ }),
  createToken({ name: 'DsGridAccessorStart', pattern: /\[#/ }),
  createToken({ name: 'ArrayMutateAccessorStart', pattern: /\[@/ }),
  createToken({ name: 'And', pattern: /&&/ }),
  createToken({ name: 'Or', pattern: /\|\|/ }),
  createToken({ name: 'Xor', pattern: /\^\^/ }),
  // 1 character
  createToken({ name: 'Plus', pattern: /\+/ }),
  createToken({ name: 'Minus', pattern: /-/ }),
  createToken({ name: 'Multiply', pattern: /\*/ }),
  createToken({ name: 'Divide', pattern: /\// }),
  createToken({ name: 'Modulo', pattern: /%/ }),
  createToken({ name: 'Assign', pattern: /=/ }),
  createToken({ name: 'Not', pattern: /!/ }),
  createToken({ name: 'LessThan', pattern: /</ }),
  createToken({ name: 'GreaterThan', pattern: />/ }),
  createToken({ name: 'BitwiseAnd', pattern: /&/ }),
  createToken({ name: 'BitwiseOr', pattern: /\|/ }),
  createToken({ name: 'BitwiseXor', pattern: /\^/ }),
  createToken({ name: 'BitwiseNot', pattern: /~/ }),
  createToken({ name: 'Comma', pattern: /,/ }),
  createToken({ name: 'Semicolon', pattern: /;/ }),
  createToken({ name: 'Colon', pattern: /:/ }),
  createToken({ name: 'Dot', pattern: /\./ }),
  createToken({ name: 'QuestionMark', pattern: /\?/ }),
  createToken({ name: 'StartParen', pattern: /\(/ }),
  createToken({ name: 'EndParen', pattern: /\)/ }),
  createToken({ name: 'StartBracket', pattern: /\[/ }),
  createToken({ name: 'EndBracket', pattern: /\]/ }),
  createToken({ name: 'StartBrace', pattern: /\{/ }),
  createToken({ name: 'EndBrace', pattern: /\}/ }),
  createToken({ name: 'Escape', pattern: /\\/ }),
  //#endregion

  //#region Literals

  createToken({ name: 'Real', pattern: /\d[\d_]*(\.[\d_]+)?/ }),
  createToken({ name: 'Hex', pattern: /(0x|\$)[\da-fA-F_]+/ }),
  createToken({ name: 'Binary', pattern: /0b[01_]+/ }),

  //#region Identifiers
  createToken({ name: 'Identifier', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ }),
];
