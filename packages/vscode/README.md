# Stitch for VSCode

This extension provides language features for GameMaker Language (GML), among other helpers for GameMaker project development.

*Stitch and its logo are trademarks of [Butterscotch Shenanigans](https://www.bscotch.net) (a.k.a. "Bscotch"). Stitch and Bscotch are unaffiliated with GameMaker.*

## 🐛 Project Status

Stitch for VSCode is in active development. Expect bugs, missing features, and frequent breaking changes. If you find a bug, please [file an issue](https://github.com/bscotch/stitch/issues/new).

You're also welcome to make feature requests, but keep in mind that we're focusing our limited time on features that we need for our own projects.

## 💡 Features

### 🤖 Intellisense

Stitch provides Intellisense (auto-complete, hovertext, function signature helpers, go-to-definition, find-references, etc) for:

- Built-in functions and constants
- Your project's global symbols, such as macros, enums, globalvars, and global functions
- Your project's resources, such as sprite IDs, object IDs, etc

### 🦋 Full syntax highlighting

Stitch provides context-aware "semantic highlighting" for global symbols, such as built-in functions and your macros, enums, globalvars, global functions, and assets.

Depending on your VSCode Theme, you may need to enable semantic highlighting to get the full effect. Additionally, you may want to tweak the colors for the different symbol types.

Here's an example of how you might update your `settings.json`:

```json

{
  //... other settings
  "editor.semanticTokenColorCustomizations": {
    "[Default Dark Modern]": { // the theme you're using
      "enabled": true, // enable semantic highlighting
      "rules": {
        "macro": "#A600FF",
        "enum": "#FF0055",
        "enumMember": "#00ADD9",
        // Built-in variables and constants
        "variable.defaultLibrary": "#58E55A",
        // Your project's global variables and constants
        "variable.global": "#96FF4C",
        // Built-in functions
        "function.defaultLibrary": "#FFB871",
        // Asset identifiers (like sprite IDs)
        "variable.asset": "#FF8500"
      }
    }
  },
  "editor.tokenColorCustomizations": {
    // Regular (non-contextual) syntax highlighting
    "[Default Dark Modern]": {
      "comments": "#7d7d7d",
      "strings": "#FFFF00",
      "numbers": "#FFFF00",
      // etc.
    }
  }
  //... other settings
}
```

### 🚀 Running your project

Hit <kbd>F5</kbd> to run your project, just like you would in the GameMaker IDE. Stitch uses the Runtime version that matches the IDE version your project uses. A terminal will pop up with the output from the GameMaker runtime.

Check out Stitch settings to configure how your project is run. In particular:

- `stitch.run.defaultConfig`: Choose a run configuration to use as the default (defaults to "Default")
- `stitch.run.defaultCompiler`: Choose whether to use the VM or YYC compiler (defaults to "VM")

### 🔍 Navigating your project

Stitch provides a tree view that mirrors the project resources in the GameMaker IDE. You can open it by clicking the Stitch icon in the Activity Bar.

Stitch also provides support for symbol search <kbd><kbd>Ctrl</kbd>+<kbd>T</kbd></kbd> via the command palette, which finds where all of your project's globals are defined. It will also pull up your asset and your object events, so you can find everything in one place.

### 📝 Opening the correct GameMaker version

Stitch provides context-menu entries and a command palette command (`Stitch: Open in GameMaker`) to open your project in the GameMaker IDE. It will ensure that you're always using the same version of GameMaker to open your projects, even automatically installing the correct version if you don't already have it!

## 🛣️ Roadmap

- Add the ability to create, delete, and rename resources (sprites, etc) from the tree view
- Provide full autocomplete, find-reference, go-to-definition, etc, even for non-globals
- Symbol rename support
- Loading the GameMaker syntax configuration that match the GameMaker version your project uses.

## ⚙️ Supported GameMaker versions

Different GameMaker versions may have different features and built-in functions, constants, etc. This extension will still work with many other GameMaker project versions, but it might give you incorrect autocompletes or surprising command outcomes!

This extension uses the GameMaker syntax definitions provided by the `GmlSpec.xml` file from GameMaker Runtime `2023.200.0.312`. You can configure this extension to use a different spec file.

## Requirements

- A GameMaker project created with a recent version of GameMaker

<!-- ## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something. -->

## ⁉️ Known Issues

- 🔥 When using `Find all references`, not all references are found
