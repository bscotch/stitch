# @bscotch/gml-syntax

A lossless, error-tolerant lexer and parser for GML (GameMaker Language).

This package has one job: **text in, syntax tree out**. It does no file I/O and knows nothing about GameMaker projects, symbols or types. Those belong to higher layers. It has no dependencies, and its results are plain, serializable data, so it's safe to use from worker threads.


## Usage

```ts
import { parse, leadingDocComments, LineIndex, walk } from '@bscotch/gml-syntax';

const { ast, tokens, diagnostics } = parse(source);

walk(ast, (node) => {
  if (node.kind === 'FunctionDeclaration') {
    const docs = leadingDocComments({ tokens }, node);
    // ...
  }
});

// Convert offsets to LSP-style positions
const lines = new LineIndex(source);
lines.positionAt(diagnostics[0].start); // { line, character }
```

## Guarantees

- **Lossless tokens.** Every character of the source belongs to exactly one token, including whitespace, comments, regions and other directives ("trivia"). Concatenating all token texts reproduces the source exactly.
- **Never throws.** Invalid source still produces a complete tree:
  - `MissingExpression` and `ErrorStatement` nodes stand in for unparseable code.
  - Each problem is reported once in `diagnostics`.
  - Consecutive unexpected tokens are merged into a single error.
- **Offsets everywhere.** Every node has `start` and `end` offsets, with `end` exclusive. Children lie within their parents and are stored in source order.
- **Comments live in the token stream,** not in the tree. Use `leadingDocComments()` to find the doc comments (`///` or `/** */`) that belong to a node.

## GML syntax decisions

These follow GameMaker's behavior where the [manual](https://manual.gamemaker.io/) documents it, and the GameMaker compiler's observed behavior where it doesn't.

- **Assignment is a statement, not an expression.** Inside an expression, `=` is an equality comparison: `a = b = c` assigns `b == c` to `a`, and `if (a = b)` compares.
- **Precedence is an assumption.** GameMaker doesn't document operator precedence, and its manual warns that precedence and evaluation order can vary by platform, so it recommends parentheses. This parser has to pick an order, so it uses `binaryPrecedence` in `src/parser.ts`, where bitwise operators bind tighter than comparisons (`a & b == c` is `(a & b) == c`).

  A syntax tree can't express that this is uncertain. Analysis should warn on mixed operators that aren't grouped with parentheses, and on call arguments whose evaluation order matters.
- **Keyword aliases** normalize to their canonical token kinds:
  - `begin`/`end` → `{`/`}`
  - `and`/`or`/`xor`/`not` → `&&`/`||`/`^^`/`!`
  - `mod` → `%`
  
  The original text can always be recovered from token offsets.
- **Macros** (`#macro [Config:]NAME body`) end at the end of the line unless it is continued with `\`. Macros are token substitution, so a body doesn't have to be an expression:
  - If the body parses cleanly as one expression, it's in `body`.
  - Otherwise `body` is `null` and the raw source is at `bodyStart`..`bodyEnd`.
- **Accessors vs. arrays:** `[` followed by `$`, `?`, `|`, `#` or `@` is an accessor only when it follows something that can end an expression. Otherwise it starts an array literal, so `[$FF, #00FF00]` is an array of a hex number and a color.
- **Omitted arguments** (`f(a,,c)`) are `OmittedArgument` nodes. A single trailing comma before `)` adds no argument.
- **Unknown line-start directives,** such as the legacy `#define` used in extension GML, are kept as `directive` trivia.
- **Unterminated block comments** at the end of a file are a warning, not an error, because GameMaker accepts them.
- **Built-in names** like `self`, `other`, `global`, `pi`, and `infinity` are ordinary `Identifier` nodes. Resolving them is the analysis layer's job.

## JSDoc

`parseDocComment(text, tokens)` parses a doc comment, given its tokens. Get those from `leadingDocComments()`, or from any run of doc comment tokens. A doc comment is either a run of `///` lines or a `/** */` block.

It returns the tags, types, names and descriptions, all with source offsets. Problems are warnings, never errors.

**Tags.** It understands all of [Feather's tags](https://manual.gamemaker.io/lts/en/The_Asset_Editors/Code_Editor_Properties/JSDoc_Script_Comments.htm) and their aliases. It also handles these Stitch extensions:
- Typing any variable: `@type`, `@localvar`, `@globalvar`, `@instancevar`
- Generics: `@template`
- `@mixin`
- Links to other symbols: `@see target`, and inline `{@link target}` or `{@link target|label}` in any description

Unknown tags are kept, with kind `unknown`.

**Function documentation forms:**
- `///` lines or a `/** */` block.
- `@function name(args)`.
- A legacy GameMaker script header line, like `/// my_func(a, b)` with no tag.

**Parameter forms:**
- `name` and `[name]`
- `[name=default]`, and `name=default` without the brackets
- `...`, `[...]`, and `[name...]` for variable argument lists

**Types** are parsed by `parseDocType()`. It accepts everything Feather does:
- Unions written with `,`, `|`, or `OR`.
- Type arguments in `<>` or `[]`.
- Dotted names like `Asset.GMObject` or `Id.Instance.o_player`.

It also accepts these standard JSDoc forms:
- `*` for any type.
- `T[]` for arrays.
- String literal types like `"left"|"right"`.

Struct-shaped types (e.g. `{a: Real}`) aren't supported yet. The type model leaves room for them.

## Testing

```sh
pnpm test
```

`src/corpus.test.ts` checks the structural guarantees against all sample GML in the repo. To also check real projects, set `GML_SYNTAX_CORPUS_DIRS` to one or more project directories (separated by the platform path delimiter).
