<p align="center">
  <img src="https://img.bscotch.net/fit-in/256x256/logos/stitch.png" alt="Stitch (GameMaker Pipeline Development Kit) Logo"/>
</p>

# Stitch Monorepo

[Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch") develops and maintains a collection of tools for management of [GameMaker](https://gamemaker.io) projects. These tools are collected under the umbrella trademark "Stitch".

This monorepo includes the code for many of the Stitch projects.

> 💡 Bscotch only develops features and fixes bugs that impact our studio directly. If you need other features or fixes, feel free to fork this project to add them yourself. You may submit pull requests with your changes, but we make no promises that we will merge them.

_Butterscotch Shenanigans&reg; and Stitch&trade; are not affiliated with GameMaker&reg;._

## Stitch Projects

Some of the projects listed here are available as compiled packages via [npm](https://npmjs.com) or other 3rd party repositories. Others are only used locally.

- [**Stitch for VSCode**](packages/vscode): A [Visual Studio Code](https://code.visualstudio.com/) extension providing code editing features for GameMaker project files. Available as [`bscotch.bscotch-stitch-vscode` via the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode).
- [**Stitch YY**](packages/yy): Utilities for reading, validating, and writing `.yy` and `.yyp` files. Available as [`@bscotch/yy` via npm](https://www.npmjs.com/package/@bscotch/yy).
- [**GameMaker Project**](packages/gamemaker-project): Read and safely change GameMaker projects: assets, folders, object events, sprite frames, room instances and more, with the files on disk as the source of truth. Available as [`@bscotch/gamemaker-project` via npm](https://www.npmjs.com/package/@bscotch/gamemaker-project).
- [**GML Syntax**](packages/gml-syntax): A lossless, error-tolerant GML lexer and parser, including JSDoc and Feather types. Available as [`@bscotch/gml-syntax` via npm](https://www.npmjs.com/package/@bscotch/gml-syntax).
- [**GML Parser**](packages/parser): Semantic analysis of a GameMaker project's GML: symbols, types, references, diagnostics and editor queries (hover, go-to-definition, rename, ...), updated incrementally as files change. Available as [`@bscotch/gml-parser` via npm](https://www.npmjs.com/package/@bscotch/gml-parser).
- [**GML Formatter**](packages/gml-formatter): A safe GML formatter that preserves your line breaks. Available as [`@bscotch/gml-formatter` via npm](https://www.npmjs.com/package/@bscotch/gml-formatter).
- [**GML Language Server**](packages/gml-language-server): A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server for GameMaker projects, built on the packages above. Underpins Stitch for VSCode, and can be used with other editors. Available as [`@bscotch/gml-language-server` via npm](https://www.npmjs.com/package/@bscotch/gml-language-server).
- [**Sprite Source**](packages/sprite-source): A library for creating art asset pipelines for GameMaker projects, including a basic CLI. Built into Stitch for VSCode, but also available as a standalone thing for other workflows. Available as [`@bscotch/sprite-source` via npm](https://www.npmjs.com/package/@bscotch/sprite-source).
- [**Stitch Launcher**](packages/launcher): Utilities for automatically installing the GameMaker IDE by version, and opening GameMaker projects with specific IDE versions.
- [**GameMaker Releases**](packages/releases): Utilities for building and consuming a unified feed of GameMaker IDE releases (across all channels and platforms) paired with their Runtimes. Available as [`@bscotch/gamemaker-releases` via npm](https://www.npmjs.com/package/@bscotch/gamemaker-releases). The feed is published every weekday [here](https://bscotch.github.io/stitch/artifacts/gamemaker/v2/releases.json), and can be browsed [here](https://bscotch.github.io/stitch/gamemaker/releases).
- [**Stitch Core (LEGACY)**](https://github.com/bscotch/stitch-legacy/tree/develop/packages/core): The core SDK for managing and manipulating GameMaker projects. It includes a programmatic API and a CLI. Available as [`@bscotch/stitch` via npm](https://www.npmjs.com/package/@bscotch/stitch). (No longer maintained. Superseded by the GameMaker Project and GML Parser projects.)
- [**Spritely (LEGACY)**](packages/spritely): Utilities for batch-preparation of source images for import as GameMaker sprites. It includes a programmatic API and a CLI. Available as [`@bscotch/spritely` via npm](https://www.npmjs.com/package/@bscotch/spritely). (No longer maintained. Superseded by the Sprite Source project.)

## Development

### Setup

1. Install [pnpm](https://pnpm.io/installation)

- If you already have corepack available but do not have pnpm, you can run `npm run setup:pnpm` in this directory to install it.

2. Run `pnpm install` in this directory to install all dependencies.

- You can use [pnpm filters](https://pnpm.io/filtering) to only install the dependencies for a specific package.

3. Run `pnpm build:all` to build all packages.
