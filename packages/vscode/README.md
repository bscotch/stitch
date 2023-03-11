# Stitch for VSCode

This extension provides language features for GameMaker Language (GML), among other helpers for GameMaker project development.

**⚠️ IN EARLY DEVELOPMENT, EXPECT BUGS AND INSTABILITY ⚠️**

*Stitch and its logo are Trademarks of [Butterscotch Shenanigans](https://www.bscotch.net) (a.k.a. "Bscotch"). Stitch and Bscotch are unaffiliated with GameMaker.

## 💡 Features

- `Stitch: New GameMaker Project` command available via the file explorer context menu for folders. This command clones a template GameMaker project into that folder. A very basic built-in template is used by default, but can be overridden with the `stitch.template.path` configuration option.
- `Stitch: Open in GameMaker` command available via the palette while editing `.yyp`, `.yy`, or `.gml` files, and via the file explorer context menu for the same file types. This command opens the project in the GameMaker IDE version last used by the same project, automatically installing that IDE version if necessary.
- GML syntax highlighting
- Autocomplete for built-in GameMaker functions and constants
- Editor support for a project's global symbols (macros, script functions, script enums, and globalvars)
  - Autocomplete
  - Go-to-definition
  - Find all references
- Autocomplete for a project's resources ( sprite IDs, object IDs, ...)
- Autocomplete and validation for `.yy` and `.yyp` files
- A JSONC formatter that works on `.yy` and `.yyp` files, outputting the same format that GameMaker uses for these files (set this extension as your `defaultFormatter` for `jsonc` files)

## 🛣️ Roadmap

- Add dynamic syntax highlighting for the different resource types so they can be color-coded in the theme
- Add tree for project resources, including object events
  - Organized based on the same in-game folder view
  - Add ability to create, delete, and rename resources (sprites, etc)
- Improve autocomplete for global enums (the `.` trigger should check to the left to see what we're dotting into)
- Add resource-specific built-in autocompletes (e.g. `x` in objects)
- Differentiate the different types and scopes of variables during parsing
- Add go-to-definition and find-references for non-global identifiers
- Add commands for running projects directly through the Runtime
- Add commands for changing the target IDE & runtime version
- Rename project-specific globals
- Add mechanism to dynamically load syntax definitions that match the project's runtime version
- Add `yy` and `yyp` as specific languages instead of aliases for `jsonc`, so that autoformatting can be more properly set up.

## ⚙️ Supported GameMaker versions

This extension uses the GameMaker syntax definitions provided by GameMaker Runtime `2023.100.0.287`.

Different GameMaker versions may have different features and built-in functions, constants, etc. This extension will still work with many other GameMaker project versions, but it might give you incorrect autocompletes or surprising command outcomes!


## Requirements

- A GameMaker project created with a recent version of GameMaker

<!-- ## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something. -->

## ⁉️ Known Issues

- 🔥 When using `Find all references`, not all references are found
