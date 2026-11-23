# GML Parser Feature Inventory

Everything `@bscotch/gml-parser` currently provides to its consumers. It is used as the checklist for the overhaul described in [UPDATE.md](./UPDATE.md): every item must have a home in the new architecture before the old package is retired.

The only consumer in this monorepo is the VSCode extension (`packages/vscode`). The extension calls the parser in-process from the extension host (there is no language server).

## Regression baselines

- `src/snapshot.test.ts` compares a golden feature snapshot of `samples/project` against `snapshots/project.json`. The snapshot covers refs, definitions, hover data, completions, signatures and diagnostics. To accept intended changes, re-run the test with `UPDATE_SNAPSHOTS=1`.
- `node scripts/bench-load.ts [projectDir] [iterations]` benchmarks project load time. It uses `GML_PARSER_SAMPLE_PROJECT_DIR` if that is set.

## Project loading and info

- Initialize a project from a `.yyp`. Options:
  - `onDiagnostics`, `onLoadProgress`, `logger`, `launcher`
  - `settings.autoDeclareGlobalsPrefixes`
  - `Project.initialize(path)` is used for new projects and for import sources.
- Data exposed on the project:
  - `yyp`, `yypPath`, `dir`, `assets`, `folders`
  - `config`, `configs` (from `stitch.config.json`)
  - `ideVersion`, `helpLinks`
- Version and naming:
  - `setIdeVersion`
  - `getWindowsName` (used when running the game)
- Lookups: `getAsset(path)`, `getAssetByName`, `getGmlFile(path)`.
- Reloads: `reloadYyp`, `reloadConfig`, `syncIncludedFiles` (datafiles).
- `setLogger`.

## Asset and project manipulation

- Create objects, rooms, scripts, shaders, sounds, sprites (from a PNG) and folders.
- Rename an asset. This also rewrites code references, re-parents children, re-points object sprites and updates room instances.
- Duplicate assets, delete folders, rename folders, and remove assets by name. Removal also cleans up room order, sprite references and collision events.
- Move assets between folders (`moveToFolder`, `parent` setter).
- Low-level: `addAssetToYyp`, `registerAsset`, `Asset.from`.
- Objects:
  - Events: `objectEvents`, `ObjectEvent`, `getEventFromFilename`, `getEventByName`, `createEvent`
  - Inheritance: `parent`, `children`, `parents`
  - Also `sprite` (get/set) and `variables`
- Sprites:
  - Frames: `framePaths`, `frameIds`, `addFrames`, `deleteFrames`, `reorganizeFrames`
  - Spine: `isSpineSprite`, `spinePaths`
  - Origin and other properties are edited by writing to the yy and calling `saveYy()`
- Rooms: `roomInstances`, `addRoomInstance`, `removeRoomInstance`, `reorganizeRoomInstances`.
- Shaders and sounds: `shaderPaths`, `soundFile`.
- Asset kind helpers: `isAssetOfKind`, `assertIsAssetOfKind`, `isSound`, `isSprite`.
- Asset members: `reload`, `reloadFile`, `saveYy`, `gmlFile`, `gmlFiles`, `gmlFilesArray`.
- Module import between projects: `importAssets` / `project.import`. It resolves dependencies from yy links and from code references.
- `Spine` summaries (`new Spine(path).summarize()`).

## Language features (per-file `Code` API)

- Re-parse a file from disk or from unsaved text: `Code.reload(text?, {reloadDirty})`, `Code.remove()`.
- File properties: `name`, `path`, `asset`, `isCreateEvent`, `isStepEvent`, `startRange`, `objectEventInfo`.
- **Hover:** `getReferenceAt` gives `ref.item`, which provides the signifier's type, description and details. Sprite assets also get a frame preview.
- **Go to definition:** `signifier.def`. The extension also walks the `event_inherited` parent chain and jumps to assets.
- **Type definition:** `type.signifier.def`.
- **References:** `signifier.refs`.
- **Rename:** `isRenameable` on both the signifier and the ref, then `ref.toRenamed` and `ref.text`. Natives and assets are blocked.
- **Completion:**
  - `getInScopeSymbolsAt`
  - `getJsdocAt` (JSDoc tag and type completions)
  - `getStructNewMemberRangeAt` with `type.listMembers()`
  - `primitiveNames`
- **Signature help:** `getFunctionArgRangeAt` gives `param.idx`, `type.code`, `description` and `listParameters()`. It also drives the status-bar signature display.
- **Semantic tokens:** `Code.refs` plus signifier flags: enum, enumMember, macro, parameter, instance, native, global, local, writable, static.
- **Workspace symbols:**
  - `project.self.listMembers()`
  - `Type.listMembers(true)`
  - `Code.scopes[].local`
  - `item.mixin`
- **Diagnostics,** pushed through `onDiagnostics`:
  - Syntax errors
  - Undeclared globals and variables (with auto-declare prefixes)
  - Missing or extra arguments
  - JSDoc problems
  - Unused global functions
  - `event_inherited` inheritance warnings
  - Invalid operations
  - `GLOBAL_SELF`
  - JSDoc type mismatches
- **Copy as type:** `type.constructs`, `toFeatherString`.
- **Igor output linking:** `getAssetByName` → `getEventByName` → line.

## Type system and JSDoc

- Feather-compatible types, plus Stitch extensions:
  - Union types and the `Enum`, `EnumMember`, `Macro`, `Unknown` and `Never` types
  - `Struct<T>`
  - Generics
- JSDoc tags:
  - `@param`, `@returns`, `@type`, `@self`
  - `@localvar`, `@globalvar`, `@instancevar`
  - `@description`, `@deprecated`, `@mixin`, `@template`
- Native GML symbols from the runtime's `GmlSpec.xml`, including struct and constant types.
- Object instance variables are inherited through the parent chain.

## Known gaps (not features, listed so they aren't mistaken for regressions)

- No document symbols, inlay hints, code actions or folding.
- Formatting exists only for `.yy` files, via `@bscotch/yy`.
- Enum member references and completions are incomplete (see `TODO.md`).
- Files other than the edited one only get their diagnostics refreshed, not a full re-analysis.
- `reloadYyp` does not remove deleted assets.
