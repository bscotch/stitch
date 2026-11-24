# @bscotch/gml-formatter

A safe, configurable code formatter for GML (GameMaker Language).


```ts
import { formatGml } from '@bscotch/gml-formatter';

const { text, changed } = formatGml(source, { preset: 'bscotch' });
```

## How it works

The formatter works on the lossless token stream from [`@bscotch/gml-syntax`](../gml-syntax/). It keeps every token and comment, in order, and only rewrites the whitespace *between* tokens. The only other changes it can make are two optional insertions: a missing `;`, and parentheses around conditions.

**It never reflows code.** Line breaks inside statements are kept as you wrote them. It doesn't impose a line width, and it doesn't join or split statements. The only line breaks it changes are around braces and `else`, and only when you configure it to.

Indentation is computed from the syntax tree: blocks, brackets, switch cases, and unbraced `if`/loop bodies. Continuation lines (e.g. a line starting with `&&`, or hand-aligned arguments) can either be normalized or keep their hand-made position relative to the statement.

**Safety:**
- Code with syntax errors is never formatted. A `GmlFormatError` is thrown instead.
- Macros, template strings and multi-line strings are never touched internally.
- Every result is re-lexed and compared with the original token stream before it is returned. If anything other than whitespace and the planned insertions differs, the formatter throws instead of returning damaged code.

### Why not a Prettier plugin?

Prettier's model is to discard the author's line breaks and reprint everything from the syntax tree to fit a line width. GameMaker codebases (ours included) tend not to have a line width, and rely on hand-placed line breaks and alignment. A Prettier plugin would have to fight Prettier's own design to keep them, and would produce large diffs on existing code.

Prettier's layout engine (`prettier/doc`) can still be used on its own if width-based wrapping is ever wanted. A thin Prettier plugin wrapping this formatter is also straightforward, if editor integrations that rely on Prettier are needed.

## Presets

| Preset | Purpose |
|---|---|
| `standard` (default) | Fully normalized style. |
| `bscotch` | Matches the hand-formatted style of Butterscotch Shenanigans projects. Normalizes only conventions those projects follow almost everywhere, and preserves the rest, for minimal diffs. |

Any option can be overridden: `formatGml(source, { preset: 'bscotch', indentStyle: 'tab' })`.

On two large real projects (about 250k lines), the `bscotch` preset changes 4–7% of lines, not counting trailing whitespace. Most of those changes are:
- added semicolons;
- comma spacing;
- tab/space conversion in files that mix both.

## Options

| Option | Values | `standard` | `bscotch` |
|---|---|---|---|
| `indentStyle` | `tab`, `space`, `auto` (the file's dominant style) | `auto` | `auto` |
| `indentFallback` | `tab`, `space` (when `auto` can't tell) | `tab` | `tab` |
| `indentWidth` | number, or `auto` (detects 2 vs 4 in space-indented files) | `4` | `auto` |
| `continuationIndent` | `structural`, `preserve` (keep offset from the statement) | `structural` | `preserve` |
| `directiveIndent` | `indent`, `preserve` (`#macro`, `#region`, ...) | `indent` | `preserve` |
| `commentIndent` | `structural`, `preserve` (keep offset from enclosing block) | `structural` | `preserve` |
| `endOfLine` | `lf`, `crlf`, `auto` | `auto` | `auto` |
| `maxBlankLines` | number | `1` | `1` |
| `finalNewline` | `always`, `preserve` | `always` | `preserve` |
| `elsePlacement` | `sameLine` (`} else {`), `newLine` (`}` then `else {`), `preserve` | `sameLine` | `newLine` |
| `openBrace` | `sameLine`, `preserve` | `sameLine` | `sameLine` |
| `semicolons` | `add`, `addExceptAfterBrace`, `preserve` | `add` | `addExceptAfterBrace` |
| `conditionParens` | `add`, `preserve` | `add` | `preserve` |
| `keywordParenSpace` | `space` (`if (`), `none`, `preserve` | `space` | `space` |
| `commaSpace` | `space`, `preserve` | `space` | `space` |
| `structColon` | `spaced` (`a : 1`), `after` (`a: 1`), `preserve` | `after` | `spaced` |
| `assignmentSpacing` | `spaced`, `preserve` | `spaced` | `spaced` |
| `parameterDefaultSpacing` | `spaced`, `tight` (`b=1`), `preserve` | `spaced` | `tight` |
| `comparisonSpacing` | `spaced`, `preserve` (`==`, `<`, `&&`, `??`, ...) | `spaced` | `spaced` |
| `arithmeticSpacing` | `spaced`, `preserve` (`+`, `*`, `<<`, `&`, ...) | `spaced` | `preserve` |
| `keepAlignment` | keep extra spaces/tabs when spacing (e.g. aligned `=`) | `false` | `true` |
| `functionParenSpace` | `none` (`f(`, `function(`), `preserve` | `none` | `none` |

Some behavior applies regardless of options:
- Trailing whitespace is removed.
- No space goes before `,` or `;`, or around `.`.
- Prefix operators like `!` and `-` are kept tight against their operand, unless that would merge tokens (`- -a`).

### Safety exceptions

A missing `;` is not added after a statement that is only a name, such as `IF_DEBUG show();`. A statement like that is likely a macro that expands to part of a statement (`#macro IF_DEBUG if DEBUG`), and adding a `;` would change its meaning.

## Testing

```sh
pnpm test
```

`src/corpus.test.ts` formats all sample GML in the repo with every preset. It checks that formatting succeeds and that formatting the result again changes nothing.

To also check real projects, set `GML_FORMATTER_CORPUS_DIRS` to one or more project directories, separated by the platform path delimiter. Per-preset change statistics are logged for each one.
