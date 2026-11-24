# @bscotch/gml-analysis

Semantic analysis for GML (GameMaker Language): symbols, types, references and diagnostics, kept up to date incrementally as files change.

> 🚧 This package is part of the in-progress [GML parser overhaul](../parser/UPDATE.md). It is not yet published.

```ts
import { GameMakerProject } from '@bscotch/gamemaker-project';
import { analyzeProject, fileDiagnostics, GmlQueries } from '@bscotch/gml-analysis';

const project = await GameMakerProject.open('path/to/project');
const analyzer = await analyzeProject(project, { specs: [pathToGmlSpecXml] });
const queries = new GmlQueries(analyzer);

const ref = queries.referenceAt('scripts/Foo/Foo.gml', offset);
const symbol = queries.symbolOf(ref);
const diagnostics = fileDiagnostics(analyzer, 'scripts/Foo/Foo.gml');

// After an edit:
analyzer.setFile(file, newText);
analyzer.analyze(); // Re-checks only what's affected
```

## How it works

Analysis is built on the syntax trees from [`@bscotch/gml-syntax`](../gml-syntax/). It has four parts:

1. **Natives** (`NativeTable`): the built-in functions, variables, constants, structs and enums, loaded from the runtime's `GmlSpec.xml` files. The base instance variables (`x`, `sprite_index`, ...) belong to a base shape that every object inherits from.
2. **Declarations** (`declare`): a pure, per-file pass that finds what each file declares, without knowing anything else about the project:
   - global functions, constructors, enums, macros and globals;
   - likely instance variables;
   - function signatures.
3. **Checking** (`Checker`): walks a file against the project's symbol table. It resolves every name, infers types and records the following:
   - references;
   - scopes (for completions);
   - argument ranges (for signature help);
   - diagnostics;
   - *contributions*: the members the file adds to objects, structs and the global scope, with their inferred types;
   - exactly what the check *depended on*.
4. **The analyzer** (`GmlAnalyzer`):
   - builds the project's symbol table from the assets and all of the files' contributions;
   - checks files, and compares the old and new tables;
   - re-checks only the files whose dependencies changed, until nothing changes.

The same loop handles loading a project and updating it after an edit.

### Design

- **Entities are plain data, linked by stable string ids** (`global/foo`, `obj:o_player/hp`, `struct:Foo/bar`, `fn:foo`). There are no object graphs to keep in sync, so the table can be rebuilt at any time.
- **Types are immutable values** (`{kind: 'Struct', name: 'Foo'}`). Named types are looked up by name when they're used, so a type never goes stale when the declaration it names changes.
- **Declarations are chosen deterministically.** When many places assign the same member, the most definitive one is its declaration. In order of preference:
  1. a Create event, a constructor body, a struct literal, or a doc comment;
  2. the same object's other events;
  3. anywhere else.

  Ties go to the earlier file and position. A variable's type is everything assigned to it, unless it has a declared type.
- **Dependencies are precise.** A file depends on each name it looked up, including failed lookups, in each scope it searched. It also depends on the signatures of functions it called. Symbol types and function return types count only where they affected the result (member access, the function being called, assigned values, returns, `with` targets). An edit therefore re-checks only the files it can actually affect.

## Language semantics

- **Scripts:**
  - Function declarations are global, unless they're inside another function. This includes those inside `if` blocks.
  - In a script function, `self` is whatever instance calls it. Built-in instance variables resolve, and names assigned there are treated as the caller's variables.
  - Function *expressions* are bound to the `self` where they're created.
- **Objects:**
  - Variables are inherited from parent objects. A child assigning to a parent's variable uses the parent's declaration rather than shadowing it; assigning a function makes an override.
  - Without `event_inherited()` in its Create event, an object doesn't inherit its parent's variables.
- **`with` and `other`:**
  - `with (target)` changes `self` to the target's type, or to "some instance" when the type is unknown.
  - `other` is the scope outside the innermost `with`, or the colliding instance in a collision event.
  - Inside functions and other events, `other` is unknown and isn't flagged.
- **Constructors and functions:**
  - Constructors create a struct shape. Parent constructors' members are inherited, and `static` members belong to the struct.
  - `method(target, function)` binds the function's `self` to `target`.
  - Calling a `@mixin` function adds the variables it declares to the caller.
- **JSDoc and Feather:**
  - Supported tags: `@param`, `@returns`, `@self`, `@type`, `@template`, `@localvar`, `@instancevar`, `@globalvar`, `@description`, `@deprecated` and `@mixin`.
  - `@see` and `{@link}` targets are resolved to symbols (for go-to-definition and rename) and reported if they're broken.
  - Docs attach to the code that follows them, and to a function declaration even across blank lines.
- **Room and instance creation code** are analyzed, with the right `self`.

## Diagnostics

`fileDiagnostics(analyzer, fileId, options)` combines:
- diagnostics found while checking;
- diagnostics that depend on the whole project;
- optional style checks.

| Code | Meaning |
|---|---|
| `syntax` | Syntax errors (from `gml-syntax`) |
| `jsdoc`, `jsdoc-mismatch`, `unknown-type`, `broken-link` | Doc comment problems |
| `undeclared-global`, `undeclared-variable` | Names that aren't declared anywhere |
| `missing-argument`, `too-many-arguments` | Argument counts. Explicitly omitted arguments (`f(a,,c)`) and trailing commas are allowed. |
| `unused-function` | Global functions that nothing references |
| `global-self` | `self`/`other` referring to the global scope |
| `invalid-operation` | E.g. dot access on a non-struct, an undefined enum member |
| `shadowed-native` | A declaration with the same name as a built-in |
| `mixed-operators` | *(Off by default)* Operators of different precedence mixed without parentheses. GameMaker's precedence can vary by platform. |
| `argument-evaluation-order` | *(Off by default)* More than one argument has side effects. GameMaker's argument evaluation order can vary by platform. |

## Compared with `@bscotch/gml-parser`

`src/snapshot.test.ts` compares this package's analysis of `../parser/samples/project` against the golden snapshot recorded from the old parser. Every reference resolves to the same declaration, and completions are identical. `node scripts/compare-snapshot.ts` prints the remaining (intended) differences, which include:
- References from doc types (`@param {Struct.Foo}`) cover just the name, which is better for rename.
- Documented-only parameters (for functions that use `argument[n]`) are declared, and appear in signatures but not as variables.
- Methods called from inside `method()` and constructor bodies now resolve, so they get signature help.
- `throw` is treated as the keyword it is.

On two large real projects, the old parser's diagnostics included many false positives. The new analysis reports fewer of most kinds, mainly because of the script-function and `other` semantics above.

## Status

Done:
- natives, declarations, checking, incremental analysis and diagnostics;
- the core queries: references, scopes and completions, and signature help.

Still to come in this phase:
- hover text;
- rename edits;
- semantic tokens and workspace symbols;
- worker-thread parallelism, and caching results between sessions.

## Testing

```sh
pnpm test
```

To also analyze real projects, set `GML_ANALYSIS_CORPUS_DIRS` to one or more project folders, separated by the platform path delimiter.
