# @bscotch/gml-syntax

A lossless, error-tolerant lexer and parser for GML (GameMaker Language).

This package has one job: **text in, syntax tree out**. It does no file I/O and knows nothing about GameMaker projects, symbols or types. Those belong to higher layers. It has no dependencies, and its results are plain, serializable data, so it's safe to use from worker threads.

> 🚧 This package is part of the in-progress [GML parser overhaul](../parser/UPDATE.md). It is not yet published.

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
- **Precedence:** bitwise operators bind tighter than comparisons (`a & b == c` is `(a & b) == c`). See `binaryPrecedence` in `src/parser.ts`. The manual recommends always using parentheses, because platforms may differ.
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

## Testing

```sh
pnpm test
```

`src/corpus.test.ts` checks the structural guarantees against all sample GML in the repo. To also check real projects, set `GML_SYNTAX_CORPUS_DIRS` to one or more project directories (separated by the platform path delimiter).
