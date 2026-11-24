# @bscotch/gml-language-server Changelog

## 1.1.0 (2026-11-24)

### Features

- The gml-language-server package now has a stitch/globalNames request listing the project's global symbols and a runServer() helper for running it in its own process, and it no longer resets its settings when a client sends empty configuration changes.
- Added the (unpublished) @bscotch/gml-language-server package: a Language Server Protocol server for GameMaker projects, providing diagnostics, hover, completion (including doc-comment tags and types), signature help, navigation, references, rename, semantic tokens, workspace symbols and formatting, plus Stitch requests for symbol info and asset-rename code edits.

### Fixes

- Workspace symbol search in Stitch for VSCode again includes only the local variables of the file in the active editor, rather than those of every open document.