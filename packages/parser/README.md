# GameMaker Language (GML) Parser (`gml-parser`)

A parser, project model, and meta-programming tool for [GameMaker](https://gamemaker.io/) projects, which provides the core project-management features provided by [Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode).

This package can also be used independently of Stitch for VSCode to create automations and pipelines for working with GameMaker projects.

**⚠️💀 Use at your own risk, and use source control! This is a meta-programming tool, so it _will_ make changes to and _might_ completely break your project! 💀⚠️**

Stitch is developed by [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch"). Support this project by buying [our games](https://www.bscotch.net), [reporting issues](https://github.com/bscotch/stitch/issues), and [contributing](https://github.com/bscotch/stitch/tree/develop/packages/parser).

## Overview

This package was developed to replaced our [Stitch CLI](https://github.com/bscotch/stitch/tree/develop/packages/core), so that we could support newer versions of GameMaker and provide underlying features for using VSCode as an alternate GameMaker IDE via [Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode).

Unlike the Stitch CLI, which is focused on high-level project management, this parser fully models an entire project, including reference and resource tracking.

## Requirements

- [Node.js](https://nodejs.org) v20+
- Windows. Might partially work on other operating systems, but it is developed and tested only on Windows.

⚠️ This project supports a narrow set of GameMaker versions. It does not try to be backwards-compatible with every version of GameMaker, and may not properly handle changes in the most recent versions either. It may break your project if your GameMaker version isn't fully compatible.

## Installation

This package does not provide a CLI, but it can be imported into Node.js projects to make your own pipelines and automations for GameMaker projects.

If you have Node installed, you can use this package by:

1. Opening a terminal
2. Changing the working directory to wherever your scripts live
3. Adding a `package.json` file if you don't already have one (by running `npm init`)
4. Installing this package via `npm install @bscotch/gml-parser` (or the equivalent with another package manager)

Then you can import things from this package (ESM-style):

```js
import { Project } from '@bscotch/gml-parser';

const project = await Project.initialize('path/to/your/project.yyp');
```

## Usage

This package provides a lot of features, which are mostly exposed via instances of the `Project` class. Some examples are provided here, but these docs are incomplete. You can use Typescript's inference/autocomplete and [peruse this package's source code](https://github.com/bscotch/stitch/tree/develop/packages/parser) to discover more parts of the API.

### (Re)load a project

When the parser loads a project it has to discover every asset and parse every line of code, so it can take a while for large projects!

However, once it's been loaded it'll stay up to date whenever you manipulate your project using the Project instance's methods. So you only have to load things once, unless you manipulate your project externally to the Project instance's methods.

```ts
import { Project } from '@bscotch/gml-parser';

// Load a project into memory, which will parse all of the code,
// discover all assets,
// and create a model of the project you can then interact with.
const project = await Project.initialize('path/to/your/project.yyp');

// If you've changed something in the project's files *externally*
// to the Project model, you can do a full reload of the project
// to make sure you're up to date.
await project.reload();
```

### View/Manage Project metadata

```ts
// Get the project's directory
project.dir;

// Get the config (see https://github.com/bscotch/stitch/tree/develop/packages/config)
project.stitchConfig;

// Get the names of each GameMaker config
project.configs;

// List the included files
project.datafiles;

// List the folders defined in the resource tree in the IDE as POSIX paths.
project.folders;
```

### Programmatically manage assets

A `Project` instance provides methods for adding and removing assets, which you can use to build pipelines and other programmatic tools.

```ts
// Get a GML file in its parsed state. Returns a Code instance,
// which includes various methods for querying/modifying them.
const code = project.getGmlFile(
  '/path/to/my/project/scripts/some_script/some_script.gml',
);

// Find an asset. Assets are represented by Asset instances,
// which include a variety of methods to query and manipulate them.
const asset = project.getAssetByName('a_room_or_sprite_or_whatever_name');

// List the assets found in a given asset-tree folder
await project.listAssetsInFolder('some/folder', { recursive: true });

// Rename an asset-tree folder (equivalent to "moving" it)
await project.renameFolder('old/folder/path', 'new/folder/path');

// Create an asset-tree folder
await project.createFolder('new/folder/path');

// Rename an asset, including all of its references in code and by other asset definitions.
await project.renameAsset('old_name', 'new_name');

// Delete an asset from the project. This does not remove code
// references, but does try to clean up other kinds of references.
// E.g. removing a sprite will also remove references to that sprite
// in Object definitions, and removing an object asset will remove
// its references as a parent to any of its children.
await project.removeAssetByName('unwanted_asset_name');

// Create a sound asset from an audio file
await project.createSound(
  'folder/subfolder/my_new_sound',
  '/path/to/source/file.wav',
);

// Create a sprite asset from an image
await project.createSprite(
  'folder/subfolder/sp_my_sprite',
  '/path/to/source/file.png',
);

// And so on and so on. You can create new objects, rooms, etc.
// Each asset is modeled by an Asset instance, which will allow
// you to do further queries and manipulations (like adding a sprite
// to a room, or adding a new object event, or setting the code
// for a script, or adding a sprite to an object, or setting an
// object's parent, etc)

// Import assets from another project into this one
await project.import(someOtherProject, {
  /* import options */
});

// Sync the project's Included Files with the files found on disk
await project.syncIncludedFiles();

// Ensure that a discovered asset's yy file is represented
// by an entry in the project's yyp file. Useful for recovering
// orphaned assets!
await project.addAssetToYyp('paty/to/orphaned/resource.yy');
```
