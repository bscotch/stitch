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

Main entrypoint for reading and writing Yy files:

```ts
// In Typescript, or in an ES6 module:
import { Yy } from '@bscotch/yy';

// Has sync and async versions.
let parsedFile = Yy.readSync('./my-project.yyp');
parsedFile = await Yy.read('./my-project.yyp');

const reStringified = Yy.stringify(parsedFile);
```

Update the version of a GameMaker project by setting the per-target version fields in all options files:

```ts
import { setProjectVersion } from '@bscotch/yy';
await setProjectVersion('my/project.yyp', '1.2.3.4');
```

Ensure a script exists, for example to update a script containing version information as part of a build pipeline (note that the [`@bscotch/gml-parser](https://www.npmjs.com/package/@bscotch/gml-parser) project is more full-featured for managing assets):

```ts
import { addScript } from '@bscotch/yy';
await addScript('my/project.yyp', 'versioning', 'global.VERSION = 1.2.3.4');
```

Ensure a collection of audio or texture groups exist, for example as part of an automatic group-assignment pipeline:

```ts
import { ensureGroups } from '@bscotch/yy';
await ensureGroups('my/project.yyp', 'audio', [
  'MyAudioGroup',
  'MyOtherAudioGroup',
]);
await ensureGroups('my/project.yyp', 'texture', [
  'MyTextureGroup',
  'MyOtherTextureGroup',
]);
```

### CLI

This package provides a few CLI commands, available with the command `yy` if globally installed (e.g. by `npm i -g @bscotch/yy`) or by `npx yy` for a local install.

### `yy diff`

Get a diff between two `.yy`/`.yyp`-like files:

`yy diff file1.yy file2.yy`

### `yy version`

Set the projects version via all of its Options files, so that all platforms will be synced to a particular version:

`yy version path/to/project.yyp 1.2.3.4`
