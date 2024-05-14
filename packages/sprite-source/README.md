# Sprite Source

This project provides utilities for creating art asset pipelines for GameMaker games. It is used in [Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode) and developed against the pipeline and team requirements of [Butterscotch Shenanigans](https://www.bscotch.net/). It may or may not be applicable to other use cases.

## Core Concepts

An "art pipeline" is the process by which an artist gets from their art editing/creating tools (like Clip Studio Paint) to having an in-game sprite. For the approach taken by this package, an art pipeline consists of the following:

1. Art Generator. The tools used by artists to create art assets. In our case, Clip Studio Paint.
2. A "Sprite Source". A Sprite Source is a collection of _raw_ art exports created by the Art Generator, placed into "staging" areas. This is all governed by a `sprites.source.json` configuration file. Staging areas are listed in this file, where each consists of:

   - A directory where raw exports can be found.
   - Configuration information for how raw files should be transformed. For example, whether images should be renamed, cropped, and/or bled.

3. A "Sprite Destination" (SpriteDest). This is assumed to be a GameMaker project, where final versions of art assets should end up as sprite frames. This is all governed by a `sprites/.stitch/sprites.import.json` config file in the GameMaker project. This config file contains an array of "sources", where each source includes:
   - The path to a Sprite Source
   - Optional paths to "Collaborator Sources". These are other Sprite Sources that are _not_ used for import, but if sprites are found in both the source and the collaborator sources, then imports will only happen if
   - Options to ignore source files or auto-prefix them

## Usage

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
