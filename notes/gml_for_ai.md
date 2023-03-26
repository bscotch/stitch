GameMaker Language (GML) has similar grammar and syntax to JavaScript ES3 but does have significant differences. Treat GML as if it is JavaScript, but with the following differences:

- GML uses `self` instead of `this`
- GML calls objects "structs"
- GML calls numbers "reals"
- GML uses `pointer_null` instead of `null`
- GML uses the constant `infinity` (all lower-case) instead of capitalized `Infinity`
- GML has a `typeof()` function instead of a `typeof` unary operator
- GML has an `instanceof()` function instead of the `instanceof` binary operator
- GML JSDoc comments use single-line comments indicated by `\\\`
- GML names can only include alphanumeric and underscore characters, though the first character must not be a number.
- Instead of classes, GML uses "constructor functions" that insert the `constructor` keyword between the parameters and body: `function MyConstructorFunction () constructor {/* body */}`
- GML strings can only be wrapped in double-quote characters
- GML uses `var` but does not have `let` nor `const`
- GML has "macros", defined with the keyword `#macro`: `#macro my_macro "some_expression"`. Macros can be defined over multiple lines by ending each line with a `\` character. At compile time, macro references are replaced with their values as if they were copy-pasted.
- GML arrays, strings, and functions have no internal functions, so the `.`-accessor cannot be used on them. For example, to get the length of an array you'd use `array_length(the_array)` instead of accessing a `length` property.
- To access a struct property, GML uses `[$ the_field]` instead of `[the_field]`. Struct properties can also be accessed with the `.` operator, just like a JavaScript object.
- GML has a few other data types that also use modified accessors:
  - `ds_list` indexes are accessed with `[| the_index]`
  - `ds_map` fields are accessed with `[? the_field]`
  - `ds_grid` coordinates are accessed with `[# x_pos, y_pos]`


In addition to the differences listed above, GML has some special features:

- The XOR operator: `^^`
- Binary literals can be written by using `0b` as a prefix. For example, `0b10` represents decimal 2 in binary.
- Hexadecimal literals can be written by using `0x` or `$` as a prefix. For example, `$001122`
- The nullish coalescing operator `??`
- Combined assignment operators:
  - `??=`
  - `|=`
  - `&=`
  - `^=`
  - `-=`
  - `+=`
  - `*=`
  - `/=`
- Code-folding regions can be created using the `#region` and `#endregion` keywords


The following comprehensive list includes all of the GML keywords:

- `begin` (equivalent to `{`)
- `end` (equivalent to `}`)
- `if`
- `then`
- `else`
- `while`
- `do`
- `for`
- `break`
- `continue`
- `with`
- `until`
- `repeat`
- `exit`
- `and` (equivalent to `&&`)
- `or` (equivalent to `||`)
- `xor` (equivalent to `^^`)
- `not` (equivalent to `!`)
- `return`
- `mod`
- `div`
- `switch`
- `case`
- `default`
- `var`
- `global` (a struct)
- `globalvar` (works like `var`)
- `enum`
- `function`
- `try`
- `catch`
- `finally`
- `throw`
- `static`
- `new`
- `delete`
- `constructor`
- `#macro`
- `#region`
- `#endregion`

And these are the core GML constants:

- `true`
- `false`
- `pi`
- `NaN`
- `infinity`
- `self`
- `other`
- `noone`
- `all`
- `global`
- `undefined`
- `pointer_invalid`
- `pointer_null`

