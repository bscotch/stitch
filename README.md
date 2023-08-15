<p align="center">
  <img src="https://img.bscotch.net/fit-in/256x256/logos/stitch.png" alt="Stitch (GameMaker Pipeline Development Kit) Logo"/>
</p>

# Stitch Monorepo

[Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch") develops and maintains a collection of tools for management of [GameMaker](https://gamemaker.io) projects. These tools are collected under the umbrella trademark "Stitch".

This monorepo includes the code for many of the Stitch projects.

>💡 Bscotch only develops features and fixes bugs that impact our studio directly. If you need other features or fixes, feel free to fork this project to add them yourself. You may submit pull requests with your changes, but we make no promises that we will merge them.

_Butterscotch Shenanigans&reg; and Stitch&trade; are not affiliated with GameMaker&reg;._

## Stitch Projects

Some of the projects listed here are available as compiled packages via [npm](https://npmjs.com) or other 3rd party repositories. Others are only used locally.

- [**Stitch for VSCode**](packages/vscode): A [Visual Studio Code](https://code.visualstudio.com/) extension providing code editing features for GameMaker project files. Available as `bscotch.bscotch-stitch-vscode` [via the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode).
- [**Stitch Desktop**](packages/desktop): A GUI application for managing GameMaker projects, including ensuring they are opened with a consistent GameMaker IDE version and management of audio source files.
- [**Stitch Core**](packages/core): The core SDK for managing and manipulating GameMaker projects. It includes a programmatic API and a CLI. Available as `@bscotch/stitch` [via npm](https://www.npmjs.com/package/@bscotch/stitch).
- [**Stitch YY**](packages/yy): Utilities for reading, validating, and writing `.yy` and `.yyp` files. Available as `@bscotch/yy` [via npm](https://www.npmjs.com/package/@bscotch/yy).
- [**Stitch Launcher**](packages/launcher): Utilities for automatically installing the GameMaker IDE by version, and opening GameMaker projects with specific IDE versions.
- [**Spritely**](packages/spritely): Utilities for batch-preparation of source images for import as GameMaker sprites. It includes a programmatic API and a CLI. Available as `@bscotch/spritely` [via npm](https://www.npmjs.com/package/@bscotch/spritely).
- [**GameMaker Merged Releases**](packages/releases): Utilities for merging the various GameMaker IDE and Runtime release notes into a single merged listing. Available as `@bscotch/gamemaker-releases` [via npm](https://www.npmjs.com/package/@bscotch/gamemaker-releases). Merged feeds are regularly published to [this repo's releases](https://github.com/bscotch/stitch/releases/latest/download/releases-summary.json).

## Development

### Setup

1. Install [pnpm](https://pnpm.io/installation)
  - If you already have corepack available but do not have pnpm, you can run `npm run setup:pnpm` in this directory to install it.
2. Run `pnpm install` in this directory to install all dependencies.
  - You can use [pnpm filters](https://pnpm.io/filtering) to only install the dependencies for a specific package.
3. Run `pnpm build:all` to build all packages.
  - This project uses [turborepo](https://turbo.build/). You can use [its filters](https://turbo.build/repo/docs/reference/command-line-reference/run#--filter) to build only specific packages.