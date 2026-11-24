# @bscotch/gml-language-server

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server for GML (GameMaker Language). It provides editor features for a GameMaker project, built on [`@bscotch/gml-analysis`](../gml-analysis/), [`@bscotch/gml-formatter`](../gml-formatter/) and [`@bscotch/gamemaker-project`](../gamemaker-project/).

> 🚧 This package is part of the in-progress [GML parser overhaul](../parser/UPDATE.md). It is not yet published.

## Usage

Run it as a separate process:

```sh
gml-language-server --stdio
```

Or start it on any connection:

```ts
import { startServer } from '@bscotch/gml-language-server';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

startServer(createConnection(ProposedFeatures.all));
```

The client must pass the project's `.yyp` path in `initializationOptions` (see `GmlServerInitializationOptions` in [`src/protocol.ts`](./src/protocol.ts)):

```json
{
  "yypPath": "/path/to/project/project.yyp",
  "specs": ["/path/to/runtime/GmlSpec.xml"],
  "settings": { "format": { "preset": "bscotch" } }
}
```

`specs` lists the `GmlSpec.xml` files that define GameMaker's built-in functions and constants. Usually these come from the project's runtime. Without them, the server uses the spec bundled with `gml-analysis`.

Settings can be changed later with `workspace/didChangeConfiguration`, sending the same `GmlServerSettings` object as `settings`.

## Features

- **Diagnostics** for every GML file in the project, kept up to date as files change. They include project-wide ones like unused functions. The optional checks (`missingDocs`, `mixedOperators`, `argumentEvaluationOrder`) and the severity of `argumentTypes` are set in the settings. So are asset-tree folders whose files get no diagnostics (`suppressGroups`).
- **Hover:** signatures, types, descriptions, struct and enum members, and frame previews for sprites.
- **Completion:**
  - symbols in scope, and members after a `.`;
  - new members inside a struct literal;
  - doc-comment tags after `@`, and type names inside `{}`.
- **Signature help.**
- **Go to definition and type definition.**
  - `event_inherited()` goes to the same event in the nearest ancestor that has it.
  - Assets go to their main file (an object's Create event, a shader's fragment shader, a sound's audio file, ...).
- **References and rename.** Built-ins and assets can't be renamed; the error says why.
- **Semantic tokens and workspace symbols.** Workspace symbols include assets, and the local variables of open files.
- **Formatting** with `@bscotch/gml-formatter` (the `bscotch` preset by default, or `standard`). Files with syntax errors are left alone.

### Stitch messages

| Message | Direction | Purpose |
| --- | --- | --- |
| `stitch/status` | server → client | Loading progress: `loading`, `ready` (with file count and time), or `error`. |
| `stitch/symbolInfo` | client → server | Describe the symbol at a position (its kind, whether it's built-in, its asset kind and type). Clients use this for commands like "copy type" or "edit sprite". |
| `stitch/assetRenameEdits` | client → server | The code edits that rename every reference to an asset, as a `WorkspaceEdit`. The client renames the asset's files itself. |

## Design

- **The server never writes to the project.** It keeps a read-only `GameMakerProject` that follows file changes. Clients forward their file watcher's events with `workspace/didChangeWatchedFiles`. Changing the project (creating, renaming or deleting assets, and so on) is the client's job. That keeps one writer per project, while the server always sees what's on disk.
- **Open documents override disk.** An open document's text is analyzed instead of its file. When it closes, the file on disk is used again.
- **Requests see up-to-date results.** Edits are re-analyzed shortly after they happen, and any request on a file with pending edits brings the analysis up to date first. Diagnostics for changed and open files are published right away, and every other file's diagnostics are re-checked once edits settle. Only diagnostics that actually changed are sent.

## Testing

```sh
pnpm test
```

`src/server.test.ts` starts the server in-process and talks to it over a JSON-RPC connection, using a copy of `../parser/samples/project`.
