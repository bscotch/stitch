# @bscotch/gamemaker-project

Read and safely change GameMaker projects: assets, folders, and settings, in their yyp/yy files.

> 🚧 This package is part of the in-progress [GML parser overhaul](../parser/UPDATE.md). It is not yet published.

```ts
import { GameMakerProject } from '@bscotch/gamemaker-project';

const project = await GameMakerProject.open('path/to/project');

project.on('assetAdded', (asset) => console.log('Added', asset.name));
const stopWatching = project.watch();

const player = await project.createObject('Objects/o_player', {
  sprite: 'sp_player',
});
await project.createObjectEvent(player, 'Step');
await project.renameAsset(player, 'o_hero');
```

## What it does (and doesn't)

This package only knows about project *files*. Each asset is its yy data plus the files in its folder. It knows nothing about GML semantics, so it doesn't parse code, track symbols, or rewrite code references when an asset is renamed. A higher layer composes this package with GML analysis to do that.

## Guarantees

- **Disk is the source of truth.** Every change runs in a transaction that re-reads the yyp and the yy files it touches before changing them. Changes made by GameMaker, git or other tools in the meantime are kept, never overwritten with stale data.
- **Changes are serialized.** Transactions, and the processing of external changes, run one at a time, in order. Before a transaction runs, pending external changes are processed.
- **The yyp never points to missing files.** yy files are written before the yyp. Old files are deleted only after the yyp no longer lists them. If a transaction throws, what can be undone is undone.
- **Git operations are waited out.** While `.git/index.lock` exists (e.g. during a pull or checkout), the project waits before reading changes or writing files (`gitLockTimeoutMs`, 10s by default).
- **Events reflect real changes.** On a change notification, the project compares disk with memory and emits events only for real differences. Its own writes are recognized and don't cause duplicate events. Unchanged rewrites cause no events at all.
- **Writes are minimal.** Files whose content wouldn't change are not rewritten.

## Keeping up with external changes

The project has to be told when files change. Either:
- call `project.watch()`, which uses Node's recursive file watcher; or
- forward an editor's file-watcher events with `project.notifyChanged(paths)`.

Changes are collected for a moment (`changeDebounceMs`) and then processed together.

`project.reconcile()` checks everything against disk. `project.idle()` resolves once everything pending has been processed.

Events:

| Event | When |
|---|---|
| `assetAdded` / `assetRemoved` | An asset was added to or removed from the yyp (a rename is a remove plus an add). |
| `assetChanged` | An asset's yy file changed, it gained or lost GML files, or other files in its folder changed (e.g. sprite frames). |
| `gmlChanged` | An existing GML file's content changed. |
| `yypChanged` | Something in the yyp besides its resources changed (folders, configs, included files, ...). |
| `configChanged` | `stitch.config.json` changed. |
| `includedFilesChanged` | Files in `datafiles/` changed. See `syncIncludedFiles()`. |
| `error` | Something couldn't be read. Half-written files are retried a few times. |

An `Asset` keeps its identity (`===`) while its data changes. Treat `asset.yy` and `project.yyp` as read-only, and change them through the project's methods.

## API overview

**Queries:**
- `assets`, `listAssets(kind?)`, `getAsset(name)`, `requireAsset(name, kind?)`, `getAssetByPath(file)`
- `getParent`, `getAncestors`, `getChildren` (objects)
- `listAssetsInFolder`
- `folders`, `configs`, `includedFiles`, `audioGroups`, `textureGroups`, `ideVersion`, `config`, `getWindowsName()`

**Per asset:**
- `gmlFiles` (only the files GameMaker uses: a script's file, an object's event files, a room's creation code), `orphanedGmlFiles`
- `folder`, `isInFolder()`
- Objects: `parentName`, `spriteName`, `listEvents()`, `getEventFile()`
- Rooms: `roomInstances`, `roomCreationCodeFile`
- Sprites: `frameIds`, `framePaths`, `isSpineSprite`, `spinePaths`
- Sounds: `soundFile`; shaders: `shaderPaths`

**Changes:**
- Create: `createScript`, `createObject`, `createSprite`, `createSound`, `createRoom`, `createShader`, `duplicateAsset`
- `renameAsset`, `deleteAsset`, `moveAsset`
- Folders: `createFolder`, `renameFolder`, `deleteFolder`
- Objects: `setObjectParent`, `setObjectSprite`, `createObjectEvent`, `deleteObjectEvent`
- Rooms: `addRoomInstance`, `removeRoomInstance`, `reorderRoomInstances`
- Sprites: `addSpriteFrames`, `deleteSpriteFrames`, `reorderSpriteFrames`
- Settings: `setIdeVersion`, `syncIncludedFiles`
- Anything else: `transaction(async (tx) => ...)`, using `tx.yyp()`, `tx.yy(asset)`, `tx.stageYy()`, `tx.writeFile()`, and so on.

**Importing** from another project: `importAssets(source, target, options)`, or `planImport` for a dry run. Dependencies found in yy files are handled here. Code dependencies can be passed in through `options.dependencies`.

**Other:**
- Object event helpers: `getEvent`, `getEventFromFilename`, `getEventFromLabel`, `objectEvents`
- Spine helpers: `readSpineJson`, `summarizeSpine`

## Differences from `@bscotch/gml-parser`

This package replaces the file-handling half of the old `Project`/`Asset` classes. Where the old behavior was wrong, it was fixed rather than reproduced:

- **No hidden writes.**
  - Setting a property never writes a file in the background; every change is an explicit, awaitable method.
  - Imports no longer write a log file into the project. Problems are reported as structured `ImportError`s.
- **Assets that were deleted externally are removed** when the yyp changes. The old `reloadYyp` only ever added assets.
- **GML files are the ones GameMaker uses:**
  - An object's event files come from its yy's event list, rather than from every `.gml` file in its folder. Leftover files are listed in `orphanedGmlFiles`.
  - Room and instance creation code is included.
- **Renames update every reference in the project's yy files.** References are always `{name, path}` objects, so collision events (and their files), room instances, the room order, tilesets, sequences and so on are all found. The yyp entry is updated in place, and case-only renames work.
- **Deletes clean up references:**
  - room instances (and their creation code);
  - collision events (and their files);
  - parent and sprite references;
  - the room order.
  
  Any references that remain are reported.
- **Duplicates:**
  - A duplicated room gets new instance IDs, since instance IDs must be unique across the project, and is added to the room order.
  - Duplicates keep their source's folder unless a new one is given.
- **Object events:**
  - All 16 user events and 12 alarms are listed. The old table only had User Event 0.
  - Any event type (keyboard, gesture, etc.) can be created from its file name.
- **Rooms:** instance layers nested inside layer folders are included.
- **New assets:**
  - Assets can be created at the root of the asset tree.
  - New GML files are empty.
  - Sprites get a true middle-centre origin.
- **Yyp entries:** new entries are appended. `@bscotch/yy` sorts the yyp the same way GameMaker does, so the old random insertion (to avoid git conflicts) isn't needed.

## Testing

```sh
pnpm test
```

The tests copy the sample projects in `../parser/samples` into temporary folders. The sync tests cover:
- external changes;
- half-written files;
- git locks;
- the project ignoring its own writes;
- not losing external changes made while the project's state was stale.

To benchmark loading a real project:

```sh
node scripts/bench-load.ts path/to/project
```
