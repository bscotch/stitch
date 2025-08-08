# Sprite Source

This project provides utilities for creating art asset pipelines for GameMaker games. It is used in [Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode) and developed against the pipeline and team requirements of [Butterscotch Shenanigans](https://www.bscotch.net/). It may or may not be applicable to other use cases.

**⚠️ This package will make irreversible changes to your files! Use it at your own risk, and use version control to keep everything safe.**

## Core Concepts

An "art pipeline" is the process by which an artist gets from their art from editing/creating tools (like Clip Studio Paint or Photoshop) to having an in-game sprite. For the approach taken by this package, an art pipeline consists of the following:

1. Art Generator. The tools used by artists to create art assets. In our case, Clip Studio Paint.
2. A "Sprite Source". A Sprite Source is a collection of _raw_ art exports created by the Art Generator, placed into "staging" areas. This is documented by a `sprites.source.json` configuration file. Staging areas are listed in this file, where each consists of:
   - A directory where raw exports can be found.
   - Configuration information for how raw files should be transformed. For example, whether images should be renamed, cropped, and/or bled.
3. A "Sprite Destination" (SpriteDest). This is assumed to be a GameMaker project, where final versions of art assets should end up as sprite frames (or Spine sprites). This is all governed by a `sprites/.stitch/sprites.import.json` config file in the GameMaker project. This config file contains an array of "sources", where each source includes:
   - The path to a Sprite Source
   - Optional paths to "Collaborator Sources". These are other Sprite Sources that are _not_ used for import, but if sprites are found in both the source and the collaborator sources, then imports will only happen if
   - Options to ignore source files or auto-prefix them

## Configuration

Your pipelines are configured by a combination of config files:

- A config called `.stitch/sprites.import.json` will be added to your project's `sprites` folder. This config lists your Sprite Sources and adds some options for how to handle them, like prefixing incoming sprite names.
- A config called `.stitch/sprites.source.json` will be added to _each_ of your root Sprite Source folders. These folders are what the project's `sprites.import.json` references. These configs are used to describe your "stages", which are a collection of subconfigs describing _which_ image files within the root Sprite Source folder should be exported and how to transform them (e.g. adding bleeds, cropping, or renaming).

This config files include a field called `$schema`, pointing to a JSON Schema that describes their content. If you open these config files in editors that understand that information, like VSCode and many other IDEs and code editors, you'll be able to hover over things to get descriptions, get autocompletes, and see warnings if something looks invalid.

## Usage

You can create and use pipelines using this package from Stitch for VSCode, the CLI, or programmatically.

### Requirements

To create an art pipeline, you'll need:

- A folder (of folders) of source images
  - Spine sprites are allowed
  - Only PNGs are supported
  - Each terminal folder containing one or more PNGs is treated as a "Sprite", with each PNG treated as a subimage for that sprite
    - The terminal folder name is used as the sprite name (⚠️ make sure each one is unique!)
    - The subimage order in GameMaker will match the alphabetical sort order of the PNG names
- A GameMaker project using a fairly current version of GameMaker
- Git. (Not strictly required, but a _really_ good idea!)

### Stitch for VSCode

[Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode) has this package built right into it, and has an option to turn on a "watch" mode so that as you make changes to your source images they'll immediately get imported into your GameMaker project.

To use it, get VSCode and install the Stitch extension, then open the Stitch panel and look for the "Sprite Sources" sub-panel (it's probably the bottom-most one). From there you can find buttons to add sprite source folders, add stages to them, open the config files for direct editing, toggle the import watcher, manually run an import, and see a list of sprites updated in the current session.

### CLI

To get some CLI commands, you can install this globally via `npm install -g @bscotch/sprite-source` (or `pnpm add -g @bscotch-sprite-source`). This will make the CLI command `spsrc` available in you your terminal (run `spsrc --help` to see your options).

As of writing, there are two CLI commands:

- `spsrc add-source path/to/image/collection path/to/project.yyp` will initialize the two configuration files you need to create a default pipeline
- `spsrc import path/to/project.yyp` will run the transform/import process on any changed source images, syncing your source images with your GameMaker sprites

### Programmatic

If you have a Typescript-aware code editor, you can write Node scripts in Typescript or JavaScript and get information from your editor about the programmatic API.

The main entrypoints are:

```ts
import { SpriteSource, SpriteDest } from '@bscotch/sprite-source';

const source = await SpriteSource.from('path/to/raw/exports');
// Ensure that the cached data about the raw images is up to date.
await source.update();

// Import into a project
const dest = await SpriteDest.from('my/project.yyp');
await dest.import({
  sources: [
    {
      source: source.configFile,
      prefix: 'sp_',
    },
  ],
});
```
