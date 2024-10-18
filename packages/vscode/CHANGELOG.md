# Stitch Changelog

## 1.71.0 (2024-10-18)

### Features

- Added 'stop' command and button to the runner, which kills igor and any running game instances.

## 1.70.0 (2024-08-15)

### Features

- Added slot names to the Spine Sprite viewer

## 1.69.5 (2024-07-17)

### Fixes

- JSDoc descriptions no longer remove inferred types

## 1.69.4 (2024-07-15)

### Docs

- Added description of the Stitch Runner to the docs

### Fixes

- Error traces are now clickable in the runner view.

## 1.69.3 (2024-07-15)

### Fixes

- Symbol search now only shows Function results for Functions that have the same name as their parent Script.

## 1.69.2 (2024-06-21)

### Fixes

- Resolved issue where renaming a sound asset would not properly update the sound file reference, causing compiles to fail.

## 1.69.0 (2024-04-29)

### Features

- Go-to-definition on a sound reference now takes you to the sound player instead of the yy file.
- Updated all deps

### Fixes

- The 'Set Sprite' context menu entry now works again in the Inspector panel for objects

## 1.68.3 (2024-03-26)

### Fixes

- Resolved formatting issues in the Runner logs caused by wrapping entries in the <pre> tag for horizontal spacing support

## 1.68.2 (2024-03-26)

### Fixes

- Resolved issue where logged spaces are not shown in the Runner panel

## 1.68.1 (2024-03-14)

### Fixes

- Running via command now focuses the Runner view, and styling is now properly restored on panel reload

## 1.68.0 (2024-03-08)

### Features

- Added ability to delete room instances and drag-drop reorganize them.
- Can now add object instances to rooms via the asset tree context menu
- The asset tree now lists a room's object intances
- Rooms can now be added via the resource tree context menu.

## 1.67.0 (2024-03-08)

### Features

- Newly-created projects now ensure that the default object is instanced in the default room.
- Added a command for creating a basic template project

## 1.66.2 (2024-03-07)

### Fixes

- Added a refresh button to the new Runner panel, so that changes to the styling config can be observed without re-running.

## 1.66.0 (2024-03-07)

### Features

- When running projects via the terminal, Stitch now re-uses the same terminal instead of creating a new one.
- Added support for styling runner logs

## 1.65.6 (2024-03-06)

### Fixes

- Resolved issue where the new Runner panel would not properly clear past runs, causing new runs to pile up (and all kinds of chaos)

## 1.65.5 (2024-03-06)

### Fixes

- Resolved issues setting the Runner panel font, and removed smooth-scroll from the Runner autoscroll

## 1.65.2 (2024-03-06)

### Fixes

- Added the play buttons back to the resources panel to reduce confusion
- When multiple projects exist, the picker now shows the entire path to help differentiate

## 1.65.1 (2024-03-05)

### Fixes

- The new Runner webview CSS was not being packaged
- Improved error messages when the project cannot be loaded due to a duplicate asset.

## 1.65.0 (2024-03-05)

### Features

- Completed draft of the new project Runner view
- Cleaned up the search widget UI
- Added whole-word search option.
- Log-searching is now implemented
- Added a toggle for auto-scroll
- Completed base functionality for the Runner view
- Added autoscroll to the runner view
- Moved the Runner webview into the Stitch panel
- Now only allowing one project to be loaded at a time.

### Fixes

- Resolved loading issues for the Igor webview

## 1.64.2 (2024-02-29)

### Fixes

- Added some logging to the Igor commands in VSCode

## 1.64.0 (2024-02-26)

### Docs

- Updated docs for adding sprites and sounds

### Features

- Made context menu options for adding sprites more clear and flexible
- Can now delete and reorganize sprite frames in the asset tree
- Can now delete sprite frames from the asset tree
- Can now add frames to a sprite
- Sprite Source imports now respect the allowedNames config option for new sprites.

### Fixes

- Improved prompts when adding a new sprite from a folder
- Improved prompt workflow when adding a Sprite from an image to allow renaming before creating.

## 1.63.0 (2024-02-23)

### Features

- Added drag-drop support for external images (which become new sprites)
- Can now drag sound files from external sources into the asset tree

## 1.61.1 (2024-02-23)

### Fixes

- Improved validity checks for asset names

## 1.61.0 (2024-02-22)

### Features

- Can now add new sound assets, checking names and defaults against the Stitch config

## 1.60.1 (2024-02-21)

### Docs

- Added a section for recommended extensions
- Added information about Included Files

## 1.60.0 (2024-02-20)

### Features

- Stitch for VSCode now forces included files on disk to match the YYP. The Included Files tree provides a read-only view that links to the Explorer.
- The Included Files tree now shows local folders and allows creating new folders

## 1.59.1 (2024-02-20)

### Fixes

- Resolved issue where the new sprite features prevent the extension from loading at all on non-Windows platforms

## 1.59.0 (2024-02-20)

### Features

- Added code lenses to yy files to simplify navigation to associated resources

## 1.58.0 (2024-02-20)

### Features

- Can now replace the frames of an existing sprite.

## 1.57.0 (2024-02-20)

### Features

- Can now add new sprites via the resource tree.

### Fixes

- No longer killing running instances on cache-clean.

## 1.56.0 (2024-02-17)

### Features

- Go to Definition on shader references now goes to their fragment file.
- Symbol search for shaders now takes you to the fragment file rather than the yy file
- Can now add shader assets
- Can now duplicate assets.

## 1.55.21 (2024-01-17)

### Fixes

- Updated the sprite cache JSON Schema to include the new version field

## 1.55.14 (2023-12-08)

### Fixes

- Resolved issue where duplicate extension variables would throw uncaught errors instead of emitting diagnostics

## 1.55.13 (2023-12-07)

### Fixes

- Removed unneeded dependency that also impacts build time

## 1.55.9 (2023-12-04)

### Fixes

- Added some additional logging to the 'run' command

## 1.55.7 (2023-11-28)

### Fixes

- Resolved issue where go-to-definition on 'event_inherited' calls opened the docs instead of resolving to the parent event
- Sound previews now only open upon F12, rather than as a side effect of go-to-definition. This prevents accidental opening of sounds.
- Sprite editor now only opens upon F12, rather than as a side effect of go-to-definition. This prevents accidental opening of sprite editors.

## 1.55.6 (2023-11-28)

### Fixes

- Resolved issue where inaccessible Program Files folders block checking for GameMaker installs

## 1.55.0 (2023-11-06)

### Features

- Improved "Show in Asset Tree" command to work with all editor view types
- Added option to auto-open folders when a filter is applied

## 1.54.1 (2023-11-02)

### Fixes

- Resolved issue where non-watcher functionality was lot from the Sprite Source tree

## 1.54.0 (2023-11-02)

### Features

- Sprite watchers now work at the source level instead of staged level, have improved debounce logic, and include a setting to enable on startup

## 1.53.1 (2023-11-01)

### Fixes

- Disabled the killOthers option on non-Windows platforms, since it'll error out

## 1.53.0 (2023-11-01)

### Features

- Added option to kill other running project instances on run, enabled by default

## 1.52.1 (2023-10-31)

### Fixes

- Replaced go-to-def for native symbols to using a separate command to resolve the problem where pressing Ctrl while hovering over a native symbol opens the docs

## 1.52.0 (2023-10-30)

### Features

- Go-to-definition on native functions now opens the online GameMaker help for that function
- Go-to-definition for sprite and sound references now open them in the editor
- Dragging assets onto another asset in the tree now moves them into the parent folder of the drop target

## 1.51.4 (2023-10-26)

### Docs

- Replaced youtube embed with a link

## 1.51.3 (2023-10-26)

### Docs

- Embedded an overview video about using Stitch

## 1.51.2 (2023-10-18)

### Fixes

- Bumped the vscode engine version

## 1.51.1 (2023-10-05)

### Docs

- Added info about the new asset import feature to the docs

## 1.51.0 (2023-09-29)

### Features

- Drafted asset importer workflow

### Fixes

- Removed option to set target folder for now since it does not work

## 1.50.1 (2023-09-25)

### Fixes

- Resolved issue where symbol renames wouldn't trigger if the cursor position was right after the symbol

## 1.50.0 (2023-09-25)

### Features

- Added setting to adjust the autoimport delay for sprit sources

## 1.49.1 (2023-09-20)

### Fixes

- Now enforcing calls to various SpriteSource methods to be sequental to prevent race conditions

## 1.49.0 (2023-09-20)

### Features

- Stitch now prompts to install the project's GameMaker version if it is missing when the user "runs" the project

### Fixes

- Missing Sprite Sources now indicate that in the tree instead of a noisy popup

## 1.48.2 (2023-09-20)

### Fixes

- Bumped the manifest engines version to 1.82.0 to match the updated deps

## 1.48.1 (2023-09-20)

### Fixes

- Windows-specific SpriteSource code should now be skipped on other platforms

## 1.48.0 (2023-09-20)

### Features

- Bumped all deps

## 1.47.2 (2023-09-18)

### Docs

- Added a link to the new changelogs

## 1.47.1 (2023-09-15)

### Fixes

- Changes to zoom levels in the Sprite viewer are now saved on a per-sprite basis

## 1.47.0 (2023-09-14)

### Docs

- Updated license files for clarity regarding sample assets

### Features

- Added a Spine Sprite summary to that editor, showing events and animations
- Added previes for Spine sprites using the offiicial Spine player

## 1.46.0 (2023-09-14)

### Features

- Added setting for the default minimum width of sprite frame previews

### Fixes

- The sprite editor should now update to reflect changes to sprites
- Resolved issue where the Sprite watcher would turn itself off

## 1.45.0 (2023-09-13)

### Features

- Added watcher toggle for SpriteSource stages

## 1.44.0 (2023-09-13)

### Features

- Added "Add Stage" command for Sprite Sources

### Fixes

- Resolved issue with new sprites not appearing after import

## 1.43.1 (2023-09-13)

### Fixes

- No longer reloading the project upon external yyp change, as this can create weird scenarios like missing assets

## 1.43.0 (2023-09-13)

### Features

- Added more items and commands to the SpriteSource tree

## 1.42.0 (2023-09-13)

### Features

- Added command for clearing the Recent Imports list

### Fixes

- Improved logging

## 1.41.3 (2023-09-13)

### Fixes

- Improved error logs and resolved an issue when importing sprites

## 1.41.2 (2023-09-12)

### Fixes

- Resolved build issue

## 1.41.0 (2023-09-12)

### Features

- Added a command for clearing the sprite-source caches
- Added a setting to change how recent changes in sprite sources are sorted

### Fixes

- Improved sorting of changed sprites by having those changed closely in time sort alphabetically
- Renamed pixel-checksum's "index.node" file to "pixel-checksum.node" to avoid future collisions and add clarity
- Updated vscode build so that the pixel-checksum .node file will be included

## 1.40.2 (2023-09-11)

### Fixes

- Removed sharp for now until I can figure out how to get it bundled with the vscode extension

## 1.40.1 (2023-09-11)

### Fixes

- Resolved issue with loading sharp

## 1.40.0 (2023-09-08)

### Features

- Added an improved tree and set of commands for "Sprite Sources"

## 1.39.0 (2023-08-31)

### Features

- Sprite Sources are now importable
- Added command to open the Sprite Source folder in File Explorer
- Added command for deleting a Sprite Source
- Implemented adding and saving Sprite Sources
- Added JSON Schemas for Spritely and Stitch-Sprite-Add sources

### Fixes

- The sprite sources tree now updates when projects are updated
- If a sprite source cannot be found, clicking its entry now brings the user to its setting

## 1.38.0 (2023-08-30)

### Features

- Updated the sprite editor to include a zoom option, and improved cursor appearance and interaction

### Fixes

- Unignored webview javascript files
- Upon updating an image, the corresponding tree item now also updates

## 1.37.0 (2023-08-29)

### Features

- Added a presets dropdown to the sprite origin editor

## 1.36.0 (2023-08-29)

### Features

- Clicking a sprite in the asset tree now takes you to the sprite editor instead of a first-frame preview
- Implemented a basic sprite-origin editor

## 1.35.0 (2023-08-28)

### Features

- Added command to run the project without defaults, using QuickPick menus for config/compiler options

### Fixes

- Added presence of any GameMaker filetype as an activation event
- Resolved issue with opening GameMaker when no project file is in focus

## 1.34.0 (2023-08-25)

### Features

- Added an option to auto-declare missing globals matching prefix patterns
- Added config option to suppress diagnostics by asset group
- Added a typeDefinitionProvider implementation

## 1.33.0 (2023-08-25)

### Features

- Added feature that automatically cache-cleans when spine sprites are updated

## 1.32.0 (2023-08-24)

### Features

- Added command for setting an object's sprite

## 1.31.0 (2023-08-24)

### Features

- Implemented asset renaming
- Drafted signifier and asset rename functionality in the parser

### Fixes

- Resolved issue where some asset files were not being renamed

## 1.30.0 (2023-08-24)

### Features

- Renaming now includes all JSDoc references
- Updated processor to create refs from JSDoc typestring locations

### Fixes

- Improved handling of enum members so they are properly connected to parents and display correct hovertext

## 1.29.1 (2023-08-23)

### Docs

- Updated README to account for the version-setting change

## 1.29.0 (2023-08-23)

### Features

- Added custom webview to display GameMaker release notes and allow picking a version

### Fixes

- Resolved issue where config changes were not reflected until restart

## 1.28.1 (2023-08-22)

### Fixes

- Resolved conflicting 'id' fields in tree items, causing tree rendering failure for shader files and asset/folder siblings
- Added icons for animcurves and extensions

## 1.28.0 (2023-08-22)

### Features

- Objects, sprites, and audio now open to an asset file instead of the .yy file

## 1.27.0 (2023-08-22)

### Features

- Changed the inspector tree to display the first sprite subimage thumbnail instead of a generic icon
- The asset tree now displays thumbnails for sprites instead of a generic icon

## 1.26.0 (2023-08-22)

### Features

- Added commands for opening various GameMaker file and folder locations

## 1.25.0 (2023-08-21)

### Features

- Added command for setting the GameMaker IDE version for the current project via VSCode
- Added command for opening the unified GameMaker release notes from VSCode

## 1.24.2 (2023-08-21)

### Fixes

- Improved information provided by errors

## 1.24.1 (2023-08-21)

### Fixes

- Resolved missing function signatures
- Added custom error objects to enable more nuance in error handling

## 1.24.0 (2023-08-21)

### Features

- Added Sentry and related options for telemetry

## 1.23.1 (2023-08-18)

### Docs

- Added info about renaming
- Added warning about using source control

## 1.23.0 (2023-08-18)

### Docs

- Minor updates to the README

### Features

- Drafted symbol rename functionality

## 1.22.0 (2023-08-17)

### Features

- Added drag/drop for assets
- Added ability to move folders into other folders via drag-and-drop, also allowing for multi-select

### Fixes

- Added check for circularity when moving folders

## 1.21.0 (2023-08-17)

### Features

- Completed VSCode functionality for renaming and deleting folders

## 1.20.2 (2023-08-15)

### Docs

- Clarified curly handling in the README

## 1.20.1 (2023-08-15)

### Docs

- Added known limitations to the README

### Fixes

- Bumped the vscode engines version

## 1.20.0 (2023-08-15)

### Features

- Added event deletion from the asset tree
- Added asset deletion to the asset tree context menu

### Fixes

- The Inspector now updates properly when an event is deleted
- Updated all deps

## 1.19.0 (2023-08-03)

### Features

- Added autocompletes for keys in struct literals

## 1.18.0 (2023-08-02)

### Features

- Added localvars from the current file to the workspace symbols list
- Workspace symbols now include object, constructor, and mixin variables

## 1.17.0 (2023-08-02)

### Features

- Now ensuring that go-to-definition works for all types mentioned in JSDocs
- The 'other' keyword can now be followed via go-to-definition

### Fixes

- Resolved issue where git-diff view resulted in wonky syntax highlighting

## 1.16.0 (2023-07-28)

### Features

- Added mechanisms for handling addition/removal/change of files on disk

### Fixes

- Added info logs for change-on-disk events

## 1.15.6 (2023-07-27)

### Fixes

- Disabled auto-reparsing on file open so that parsing issues can be identified more easily

## 1.15.5 (2023-07-26)

### Fixes

- Resolved error cases where we are indexing into undefined

## 1.15.2 (2023-07-25)

### Fixes

- Resolved issue with syntax highlighting caused by the delayed reprocessing of files during editing

## 1.15.0 (2023-07-24)

### Features

- Added an option to specify the debounce delay for reprocessing a file during active editing

### Fixes

- Resolved issue where undefined variables would appear in the autocomplete listing
- Improved editor responsiveness by only reprocessing changed files upon certain trigger characters

## 1.14.0 (2023-07-24)

### Features

- Added the ability to set an object's parent via the sidebar

## 1.13.0 (2023-07-22)

### Features

- Added support for using @self with function types
- Added the @mixin jsdoc tag

## 1.12.0 (2023-07-21)

### Docs

- Added info about templates and utility types

### Features

- Added prereqs for generics support

### Fixes

- Updated all deps

## 1.11.0 (2023-07-20)

### Features

- Added support for localvar, globalvar, and instancevar JSDoc tags.

## 1.10.3 (2023-07-19)

### Docs

- Added info about Feather support to the README

## 1.10.1 (2023-07-18)

### Fixes

- Added missing @ signs to JSDoc snippets

## 1.10.0 (2023-07-15)

### Features

- Added editor context menu entries for copying the target item as a type string

## 1.9.0 (2023-07-15)

### Features

- Added entire parent/child heirarchy to inspector

### Fixes

- Removed dash from JSDoc snippets
- Resolved syntax highlighting jank for functions
- Made some code more robust when comparing strings

## 1.8.2 (2023-07-13)

### Fixes

- Improved some return types

## 1.8.1 (2023-07-13)

### Fixes

- When events are added to an object they now appear in the event list as expected

## 1.8.0 (2023-07-13)

### Features

- Added right-click "New Event" command to the Inspector

## 1.7.0 (2023-07-13)

### Features

- Added children to the inspector

## 1.6.0 (2023-07-13)

### Features

- Completed the first draft of the asset inspector widget
- Drafted Inspector

## 1.5.0 (2023-07-12)

### Features

- Implemented context menu command for creating new object events
- Added snippet for type and self comments

## 1.4.0 (2023-07-11)

### Features

- Added command to create new object assets

## 1.3.1 (2023-07-11)

### Fixes

- Resolved issue

## 1.3.0 (2023-07-10)

### Features

- Implemented calling the Igor Clean command

### Fixes

- Improved editor behavior in JSDocs
- Fixed triggers for autocomplete in JSDocs
- Added go-to-def for object names
- Resolved issue where logging could throw an error and break the extension
- Removed '.' as a trigger character when inside JSDocs

## 1.2.0 (2023-07-10)

### Features

- Added Seth's theme and actually switched from Preview mode

## 1.1.0 (2023-07-10)

### Features

- Bumped the VSCode extension to no longer be pre-release!

## 0.30.0 (2023-07-07)

### Features

- Added file watcher to allow updates when files are changed externally
- Added support for type autocompletes in JSDocs

### Fixes

- Projects that fail to load no longer crash the entire extension
- Reduced 'problems' noise by interpreting typeless signifiers as being an Any type
- Some light refactoring, renaming, and legacy code removal
- Resolved issue where functions missing return statements showed that they returned Unknown instead of Undefined
- Resolved issue where function types were not always named
- Updated to match the changes to the parser

## 0.29.4 (2023-06-23)

### Fixes

- Added more logging

## 0.29.3 (2023-06-23)

### Fixes

- Changed symbol search to not be case sensitive, which gives more expected results

## 0.29.2 (2023-06-22)

### Fixes

- Resolved issue where type definitions could disappear on reload
- Global symbols that don't live in `global` are no longer missing from the workspace symbols listing
- Resolved issue where native functions claimed to be undeclared
- Diagnostics are now updateable across files, at least for some cases.
- Resolved false diagnostic about an object identifier not being defined
- Improved synatx highlighting for template strings

## 0.29.1 (2023-06-21)

### Fixes

- Upon filtering the asset tree, all assets are revealed

## 0.29.0 (2023-06-21)

### Features

- Can now edit filters by clicking on them.
- Filtering now fully implemented

## 0.28.0 (2023-06-16)

### Features

- Added a command to reveal the asset associated with the open editor

## 0.27.0 (2023-06-16)

### Features

- Go-to-definition on event_inherited now brings you to the parent event

## 0.26.0 (2023-06-16)

### Features

- Added ability to create scripts via the sidebar
- Added the ability to add folders via the Stitch sidebar

## 0.25.1 (2023-06-15)

### Fixes

- Resolved misc.  jank

## 0.25.0 (2023-06-15)

### Docs

- Added notes about viewing logs

### Features

- Added a loading bar for Stitch's project loading progress.
- Added highlighted logs to the VSCode output panel

## 0.24.0 (2023-06-14)

### Features

- Added JSDoc processing inside of structs

### Fixes

- Resolved a bunch of semantic highlighting wonkiness

## 0.23.0 (2023-06-14)

### Features

- Added improved hover details for functions and structs

### Fixes

- Removed debouncing on document edit so that autocomplete triggers work as expected

## 0.22.12 (2023-06-13)

### Fixes

- Improved type inference and merging

## 0.22.10 (2023-06-12)

### Fixes

- Added '.' as completion trigger character and resolved potential function signature issue

## 0.22.8 (2023-06-11)

### Fixes

- Added assertions to possible error locations
- Added assertion function that logs when in VSCode to get around swallowed errors

## 0.22.4 (2023-06-05)

### Docs

- Updated the README

## 0.22.3 (2023-06-04)

### Fixes

- Now ensuring that a default GmlSpec.xml is included with the extension
- Resolved issue where mod and div operator highlighting did not include word boundaries.

## 0.22.2 (2023-06-03)

### Fixes

- Changed IDE opening notice to use a progress bar

## 0.22.1 (2023-06-03)

### Docs

- Updated VSCode README

### Features

- Completed base extension functionality with the full asset tree.
- Added JSDoc parsing

### Fixes

- Updated vscode engine requirement
- Resolved go-to-def for params and local vars
- Resolved a bunch of global reference issues
- Resolved issue where function params may be unknown when parsing call site
- Resolved logo issue

## 0.21.0 (2023-05-04)

### Features

- Added vertex scripts to the sidebar
- Added Sprite frames to the sidebar

## 0.20.0 (2023-05-04)

### Features

- Added file icons to the resource tree.
- Added a File Icon theme to support GameMaker filetypes
- Added hover text for built-in constants and variables

### Fixes

- Play buttons in the tree now more robustly run the appropriate project.

## 0.19.1 (2023-05-03)

### Docs

- Updated Stitch VSCode README

## 0.19.0 (2023-05-03)

### Features

- Added a function-signature-helper to the status bar, reflecting GameMaker IDE behavior, with an option to disable it.

## 0.18.2 (2023-05-03)

### Fixes

- Object events are now display in the tree with their human-friendly names

## 0.18.1 (2023-05-03)

### Fixes

- Resolved issue where project global functions were not displaying signatures.

## 0.18.0 (2023-05-03)

### Features

- Added support for scripts and Object files in the symbol lookup
- Added a 'play' button to the VSCode sidebar

### Fixes

- Update symbol lookup to include yy files for everything except scripts

## 0.17.0 (2023-05-03)

### Features

- Updated the tree view to allow for multi-project repos
- Implemented a read-only resource tree in VSCode

## 0.16.0 (2023-05-02)

### Features

- Added keybindings for running a GameMaker project
- Running a GameMaker project now disposes of the prior terminal to prevent terminal-mageddon
- Added a run command for GameMaker projects

## 0.15.0 (2023-05-02)

### Docs

- Updated readme

### Features

- Implemented semantic highlighting for globals.

## 0.14.5 (2023-04-13)

### Fixes

- A Stitch Desktop issue prevents it from loading the UI on bootup

## 0.14.4 (2023-04-12)

### Fixes

- Updated all deps, including a version of Pathy that was not properly using validators
- Updated all deps

## 0.14.2 (2023-04-08)

### Fixes

- Fixed syntax highlighting to also work with '@return'

## 0.14.1 (2023-04-03)

### Fixes

- Added snippets to not-ignored list so they're available in prod

## 0.14.0 (2023-03-31)

### Docs

- Added info about tasks

### Features

- Improved running GM from vscode

## 0.13.0 (2023-03-31)

### Features

- Added options for specifying the default compiler and config to use when running GameMaker projects
- Added stitch.task.autoDetect to allow disabling auto-detection of GameMaker runner tasks, since they can be slow to generate
- Added VSCode support for directly running game projects

## 0.12.0 (2023-03-29)

### Features

- Added intellisense for global enums in code and in JSDocs for GML

## 0.11.0 (2023-03-29)

### Features

- Added workspace symbol search for GML projects

## 0.10.0 (2023-03-29)

### Features

- Improved JSDoc autocompletions to include all built-in and project-specific global types

## 0.9.0 (2023-03-29)

### Features

- Added JSDoc-specific autocompletes for tags, constants, and core types

## 0.8.0 (2023-03-26)

### Features

- Added additional docs to built-in GML variables
- Added highlighting for regions and most operators
- Started a fresh tmlanguage doc for GML, to get away from the complexity of the Typescript grammar file
- Added snippets for a few GML features

### Fixes

- Added the copy-on-write accessor bracket to the language config
- Improved macro highlighting
- Removed '.' as trigger character until autocompletes are not just global
- globalvar and self are now syntax-highlighted

## 0.7.0 (2023-03-11)

### Features

- Updated the GmlSpec to the latest one (2023.200.0.312) and updated the README to reflect recent changes

### Fixes

- Changed name of yy 'language' to 'GameMaker Metadata' for simplicity

## 0.6.1 (2023-03-11)

### Fixes

- Added 'when' clauses to Stitch context menu items so that they don't appear when unavailable

## 0.6.0 (2023-03-11)

### Features

- Per VSCode recommendations, added a setting for disabling the YY formatter

### Fixes

- Added better popup messages and error handling when trying to open a project via GameMaker

## 0.5.1 (2023-03-11)

### Fixes

- Resolved issues with the YYP/YY formatter
- Resolved minor issues from the new GML Spec file settings

## 0.5.0 (2023-03-09)

### Features

- Added the ability to create a new GameMaker project via the VSCode extension
- Added 'Open in GameMaker' command to VSCode extension

## 0.4.2 (2023-03-06)

### Fixes

- Updated the homepage field in all manifests