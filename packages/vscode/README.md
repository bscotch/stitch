# Stitch for VSCode

This extension provides language features for GameMaker Language (GML), among other helpers for GameMaker project development.

*Stitch and its logo are trademarks of [Butterscotch Shenanigans](https://www.bscotch.net) (a.k.a. "Bscotch"). Stitch and Bscotch are unaffiliated with GameMaker.*

## 🐛 Project Status

Stitch for VSCode is in active development. Expect bugs, missing features, and frequent breaking changes. If you find a bug, please [file an issue](https://github.com/bscotch/stitch/issues/new).

You're also welcome to make feature requests, but keep in mind that we're focusing our limited time on features that we need for our own projects.

## 💡 Features

### 🤖 Intellisense

Stitch provides Intellisense (auto-complete, hovertext, function signature helpers, go-to-definition, find-references, etc) for all built-in and user-defined symbols.

### 🔍 Navigating your project

Stitch provides a tree view that mirrors the project resources in the GameMaker IDE. You can open it by clicking the Stitch icon in the Activity Bar.

Stitch also provides support for symbol search <kbd><kbd>Ctrl</kbd>+<kbd>T</kbd></kbd> via the command palette, which finds where all of your project's globals are defined. It will also pull up your asset and your object events, so you can find everything in one place.

Finally, the Intellisense features (go-to-definition, find-references, etc) make it easy to navigate the code in your project.

### 🦋 Syntax highlighting

Stitch provides context-aware "semantic highlighting" for all symbols.

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
        "enumMember": "#e97400",
        // Instance and struct variables
        "property": "#FF00A5",
        "property.static": "#FFF899",
        "variable.local": "#00FFFF",
        "parameter": "#10c3eb",
        // Built-in variables and constants
        "variable.defaultLibrary": "#58E55A",
        // Your project's global variables
        "variable.global": "#96FF4C",
        // Built-in functions
        "function.defaultLibrary": "#FFB871",
        // Asset identifiers (like sprite IDs)
        "variable.asset": "#d9760c"
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

### 🎨 Stitch Icon Theme

Stitch provides an Icon Theme based on a subset of [Material Icon Theme](https://github.com/PKief/vscode-material-icon-theme), with support for GameMaker files and common non-GameMaker filetypes.

To use it, use <kbd><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd></kbd> to open the command palette, search for "Preferences: File Icon Theme", then select "Stitch Icons". You can also set it as your default icon theme in your VSCode settings.

### 🚀 Running your project

Hit <kbd>F5</kbd> to run your project, just like you would in the GameMaker IDE. Stitch uses the Runtime version that matches the IDE version your project uses. A terminal will pop up with the output from the GameMaker runtime.

Check out Stitch settings to configure how your project is run. In particular:

- `stitch.run.defaultConfig`: Choose a run configuration to use as the default (defaults to "Default")
- `stitch.run.defaultCompiler`: Choose whether to use the VM or YYC compiler (defaults to "VM")


### 📝 Opening the correct GameMaker version

Stitch provides context-menu entries and a command palette command (`Stitch: Open in GameMaker`) to open your project in the GameMaker IDE. It will ensure that you're always using the same version of GameMaker to open your projects, even automatically installing the correct version if you don't already have it!

## ⚙️ Supported GameMaker versions

Different GameMaker versions may have different features and built-in functions, constants, etc. This extension will still work with many other GameMaker project versions, but it might give you incorrect autocompletes or surprising command outcomes!

This extension uses the GameMaker syntax definitions provided by the `GmlSpec.xml` file from GameMaker Runtime `2023.200.0.312`. You can configure this extension to use a different spec file.

## Requirements

- A GameMaker project created with a recent version of GameMaker

## 🛣️ Roadmap

- [x] Provide full autocomplete, find-reference, go-to-definition, etc, even for non-globals
- [x] Loading the GameMaker syntax configuration that match the GameMaker version your project uses.
- [ ] Symbol rename support
- [ ] Add the ability to create, delete, and rename resources (sprites, etc) from the tree view
- [ ] Add JSDoc support for comments
- [ ] Add JSDoc support for types
- [ ] Add inferred type support

## 🤔 FAQ, Tips, and Known Issues

- 🔥 **`Go To Definition` sometimes doesn't fire**. "Find all references" works well most of the time, but "Go To Definition" is a little cagey.
- 🔥 **Nested symbols are not always referenced**. When dot-accessing variables, sometimes the accessed variable does not get a reference during initial load. This is often resolved upon editing a file, but not always.
- ⁉️ **Unexpected projects appear in the tree view**. If you're seeing extra projects in your tree view, it's likely that these are being discovered inside `node_modules` or other normally-hidden locations. Stitch excludes the same files that your VSCode setup does via the `files.exclude` setting, so if you want to prevent those projects from appearing add their parent folders to your excluded files.