<p align="center"><i><a href="https://www.bscotch.net">Butterscotch Shenanigans</a> Presents:</i></p>

<h1 align="center"> Stitch Launcher: The GameMaker version manager and project launcher</h1>

[GameMaker](https://gamemaker.io) is composed of two components:

1. **GameMaker IDE**. The IDE is what you install via the GameMaker website, and is the graphical user interface for managing a GameMaker project.
2. **GameMaker Runtime**. The "Runtimes" are what take your GameMaker project and convert it into a playable game. Each IDE version installs its paired Runtime version.

GameMaker normally allows one installed IDE version per release channel, so switching between projects that use different versions means re-installing GameMaker.

Stitch Launcher keeps its own cache of GameMaker IDE versions, so that each project can be opened in the IDE version it was last saved with, and run with the matching Runtime, without re-installing anything.

> 📄 See [the notes](./NOTES.md) for how GameMaker installations work, and why this package works the way it does.

_Butterscotch Shenanigans&reg; and Stitch are not affiliated with GameMaker&reg;._

## 🚀 What Stitch Launcher does

- **Installs IDE versions into its own cache.** It downloads the official installer to your Downloads folder and extracts it (with 7-Zip on Windows and Linux, and the built-in `pkgutil` on macOS). It never runs installers, and never touches your own GameMaker installs, which keep working normally alongside it.
- **Finds installed Runtimes.** Runtimes are installed by the IDE itself, the first time an IDE version boots. Stitch Launcher only finds them.
- **Opens projects** in the right cached IDE, optionally suppressing the IDE's "IDE Update Available" prompt (which older cached versions would otherwise always show).
- **Runs and builds projects** with Igor, GameMaker's command-line build tool, using a self-cleaning build cache outside your project.

Version information comes from Stitch's [unified GameMaker releases feed](../releases/README.md).

## Requirements

- [Node.js v22+](https://nodejs.org/en/). This package is ESM-only.
- On Windows and Linux, a **full** [7-Zip](https://www.7-zip.org/download.html) install, to extract GameMaker installers. The standalone `7za` build can't extract them. macOS doesn't need it.
  - Windows: `winget install 7zip.7zip`
  - Linux: `sudo apt install 7zip` (or `p7zip-full` on older distros)
- [A GameMaker account](https://gamemaker.io/) to use GameMaker itself.

### Platform support

|                       | Windows   | macOS                    | Linux                    |
| --------------------- | --------- | ------------------------ | ------------------------ |
| Paths, runtimes, Igor | ✅ Tested | ⚠️ Partly tested (arm64) | ⚠️ Implemented, untested |
| Installing IDEs       | ✅ Tested | ⚠️ Partly tested (arm64) | ⚠️ Implemented, untested |
| Opening projects      | ✅ Tested | ⚠️ Implemented, untested | ⚠️ Implemented, untested |

GameMaker only publishes Beta, Unstable and LTS 2026 releases for Linux. The Linux details come from unpacking GameMaker's installers, not from a real machine. On macOS, finding runtimes, running Igor, and downloading, verifying and extracting IDEs have been tried on an arm64 Mac; the rest comes from unpacking the installers. Unconfirmed details are marked `TODO(verify)` in the source. Reports and fixes are welcome!

## Installation

```sh
npm install @bscotch/stitch-launcher
```

## Usage

Every function takes an optional options object, for overriding defaults like the IDE cache dir (`ideCacheDir`), the downloads dir (`downloadsDir`), and the 7-Zip path (`sevenZipPath`, Windows and Linux only). See `LauncherOptions` for all of them.

### Open a project in its IDE version

```ts
import {
  findIde,
  installIde,
  openProject,
  readProjectIdeVersion,
} from '@bscotch/stitch-launcher';

const project = 'path/to/my-project.yyp';
const ideVersion = await readProjectIdeVersion(project);
if (!(await findIde(ideVersion))) {
  await installIde(ideVersion, {
    onProgress: (p) => console.log(p.stage),
  });
}
const ide = await openProject(project); // Defaults to the project's IDE version
await ide.waitForClose();
```

`installIde` throws a `LauncherError` with a `code` you can act on, such as `SEVEN_ZIP_MISSING` (with install instructions), `VC_RUNTIME_MISSING` (Windows; points at the downloaded installer, which installs it), or `IDE_NOT_INSTALLABLE` (the version can't be downloaded anymore; lists alternatives).

### Run or build a project with Igor

```ts
import {
  findRuntime,
  getIdeVersionDetails,
  runIgor,
} from '@bscotch/stitch-launcher';

const { runtimeVersion } = await getIdeVersionDetails('2026.100.0.1199');
const runtime = await findRuntime(runtimeVersion);
if (!runtime)
  throw new Error(
    'Open the project in its IDE once, so the IDE installs its runtime',
  );

const result = await runIgor({
  project: 'path/to/my-project.yyp',
  runtime,
  command: 'PackageZip', // Default: 'Run'
  compiler: 'yyc', // Default: 'vm'
});
console.log(result.success, result.logFile);
```

Igor must be able to load the project, so the project must have been saved by an IDE that's compatible with the runtime. Use `prepareIgorCommand` to get the command without running it (e.g. to run it in a terminal).

### Manage the caches

```ts
import {
  getIdeCacheInfo,
  pruneIdeCache,
  pruneIgorCache,
} from '@bscotch/stitch-launcher';

for (const ide of await getIdeCacheInfo()) {
  console.log(
    ide.version,
    ide.channel,
    ide.sizeBytes,
    ide.installable ? '' : 'not downloadable anymore!',
  );
}
await pruneIdeCache(['2024.1400.0.904']);
await pruneIgorCache(); // Clear all Igor build caches
```

Cached versions that can no longer be downloaded can't be replaced, so `pruneIdeCache` refuses to delete them unless you pass `includeNotInstallable: true`.

## Where things go

| What                  | Default                                                                                                  | Option         |
| --------------------- | -------------------------------------------------------------------------------------------------------- | -------------- |
| Cached IDEs           | `~/.stitch/launcher/ide`                                                                                 | `ideCacheDir`  |
| Downloaded installers | Your Downloads folder                                                                                    | `downloadsDir` |
| Igor build caches     | Windows `%LOCALAPPDATA%\stitch\igor`, macOS `~/Library/Caches/stitch/igor`, Linux `~/.cache/stitch/igor` | `igorCacheDir` |
| Launcher state        | `~/.stitch/launcher`                                                                                     | `stateDir`     |

Older versions of this package put Igor's caches in `<project>/tmp/igor`. Those folders are no longer used and can be deleted.

## Development

- `pnpm test` runs the unit tests, which don't need GameMaker.
- Integration tests are opt-in; see [`src/integration.test.ts`](src/integration.test.ts):
  - `STITCH_LAUNCHER_INTEGRATION=1`: read-only checks against this machine's GameMaker installs, plus an Igor build of `samples/project`.
  - `STITCH_LAUNCHER_INTEGRATION_INSTALL=1`: downloads and extracts an IDE into a temp dir.
  - `STITCH_LAUNCHER_INTEGRATION_IDE=1`: launches the IDE, and temporarily changes its `default_macros.json`.
  - Optional: `STITCH_LAUNCHER_IDE_VERSION` overrides the IDE version (default: the sample project's), and `STITCH_LAUNCHER_FEED_FILE` uses a local v2 releases feed file instead of fetching it.
- `node scripts/generate-igor-types.mts [path/to/Igor]` regenerates the Igor CLI types from Igor's usage text.
