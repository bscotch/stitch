# GameMaker `yy` and `yyp` parser/stringifier

Read and write GameMaker's `.yyp` and `.yy` files!

[GameMaker](https://gamemaker.io/en) projects consist of a variety of filetypes, with much of the core metadata described in the project root `.yyp` file and resource-specific `.yy` files. Being able to manipulate these files programmatically, outside of GameMaker's editor, is useful for building custom pipelines.

This package provides parse, strinfification, validation, and reading/writing of GameMaker's `.yyp` and `.yy` files.

## GameMaker Compatibility

Different GameMaker versions can have different project file formats. This package aims to support recent versions of GameMaker only, with some amount of backwards compatibility.

## Why use this package?

`yy` and `yyp` files are JSON-ish, but don't follow the JSON spec. In general, existing JSON utilities either won't be able to read `yy` files successfully or will write them differently from how GameMaker does it. In the latter case the files might still be functional, but will be reformatted by GameMaker and therefore act as a source of version control noise.

How these files depart from JSON:

- The files include trailing slashes, which are invalid in JSON
- Files can include large integers that are beyond the range of default `Number` types
- The spacing behavior does not match typical JSON prettifying behavior

## Requirements

- Node.js v16+
- A Node.js project in which you want to use this package.

## Installation

In your project root:

- npm install @bscotch/yy

## Usage

### Programmatic

In your Node code:

```ts
// In Typescript, or in an ES6 module:
import { Yy } from '@bscotch/yy';

// Has sync and async versions.
let parsedFile = Yy.readSync('./my-project.yyp');
parsedFile = await Yy.read('./my-project.yyp');

const reStringified = Yy.stringify(parsedFile);
```

### CLI

Currently this package provides one CLI command, which generates a diff between two `.yy`/`.yyp`-like files:

- If globally installed: `yy diff file1.yy file2.yy`
- If locally installed: `npx yy diff file1.yy file2.yy` (or similar, depending on your Node package manager)
