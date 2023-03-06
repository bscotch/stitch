<p align="center"><i><a href="https://www.bscotch.net">Butterscotch Shenanigans</a> Presents:</i></p>

<h1 align="center"> Stitch Launcher: The GameMaker version manager and project launcher</h1>

[GameMaker](https://gamemaker.io) is composed of two components:

1. **GameMaker IDE**. The IDE is what you install via the GameMaker website, and is the graphical user interface for managing a GameMaker project.
2. **GameMaker Runtime**. The "Runtimes" are what take your GameMaker project and convert it into a playable game. They are normally managed via the GameMaker IDE. A given IDE version may work with multiple Runtime versions.

These components are delivered as completely distinct bundles and versioned independently. Knowing which version of each you should be using for a given project, and switching between versions, is a tedious, manual process.

> 📄 See [the notes](./docs/gamemaker-engine.md) for more information about how GameMaker installations work.

## 🚀 What Stitch Launcher Does

This package provides helper utilities for automating switching between and installing IDE and Runtime versions, allowing higher-level workflow tools to not have to know the details.

It is used by the [Stitch](https://www.npmjs.com/package/@bscotch/stitch) to provide CLI commands for opening a GameMaker project with a specified IDE and Runtime version. See Stitch's docs for more information.

> **💀 WARNING 💀** Stitch Launcher is in active development and may change substantially from version to version. Use at your own risk!

_Butterscotch Shenanigans&reg; and Stitch are not affiliated with GameMaker&reg;._

## 🪲 Known Issues

While GameMaker IDEs can be directly downloaded and installed, even without a GameMaker license, GameMaker Runtimes can only be installed through GameMaker itself. GameMaker Runtimes can be used to install other Runtimes, but there are a myriad of licensing issues and GameMaker CLI bugs that make this a fragile process.

Stitch Launcher _may_ attempt to install missing runtimes, but there's a good chance you'll run into errors when you specify runtimes that aren't already installed. The two solutions are:

1. Through the GameMaker IDE, install the the beta Runtime v2022.300.0.476. This Runtime is known to be able to install other Runtimes, so long as your GameMaker license is valid and your GameMaker IDE login has not expired (just but up the IDE and log in if it has). Stitch Launcher attempts to use that Runtime version unless you specify a different one, in cases where Stitch Launcher will try to install missing Runtimes for you.
2. Install all Runtimes manually, through the GameMaker IDE. Stitch Launcher will still make it easy to ensure that you're using the Runtime version you want to be using, even if it can't be used to install them for you.

## Requirements

- [Node.js v16+](https://nodejs.org/en/). This package is only exported as ESM -- [here's a guide](https://adamcoster.com/blog/commonjs-and-esm-importexport-compatibility-examples) to how to import it if you're using CommonJS.
- [A GameMaker license](https://gamemaker.io/). This package can be used to automate downloading and installing of GameMaker components, but you'll need to have a GameMaker license to actually use it!

## Installation

In a Node project, run `npm install @bscotch/stitch-launcher`

## Usage

This package exports the class `GameMakerLauncher`. Import this into a Node project and use your editor's Typescript intellisense features to discover the available properties and methods.

Some examples (in Typescript):

### Example: Open a project with a specific IDE/Runtime combo

```ts
import { GameMakerLauncher } from '@bscotch/stitch-launcher';

// Open a project with a specific IDE/Runtime combo
// (downloads and installs will happen automatically)
await GameMakerLauncher.openProject('path/to/my-project.yyp', {
  ideVersion: '2022.2.2.2',
  runtimeVersion: '2022.1.1.1',
});
```

### Example: Run/build a project with a specific Runtime

While you can use the GameMaker IDE to specify the runtime to use, you may want to be able to run or build a project _outside_ of the IDE. For example, you may want to re-run the project every time you update its files, or you may want to automate some build-related tasks.

> 📝 **Note:** Directly running/building projects via the Runtime (instead of doing so indirectly via the IDE) may only work for Enterprise GameMaker licenses for some platform targets.

```ts
import { GameMakerLauncher } from '@bscotch/stitch-launcher';

// Directly use a specific Runtime to run a project
await GameMakerLauncher.runProject('path/to/my-project.yyp', '2022.0.0.0');
```
