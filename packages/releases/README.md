# GameMaker Releases

[GameMaker](https://gamemaker.io/) publishes new builds across several release channels (LTS, Beta, and more) and platforms (Windows, macOS, and Linux). Each release has two separate artifacts: an IDE and a Runtime. GameMaker's own feeds list those separately, and none of them say which Runtime goes with which IDE.

This package combines all of that into a **single, unified feed of GameMaker IDE releases, each paired with its Runtime**. It is used by [Butterscotch Shenanigans](https://www.bscotch.net) to power [Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode) and other tools.

The feed is updated every weekday and published at:

- Feed: https://bscotch.github.io/stitch/artifacts/gamemaker/v2/releases.json
- JSON Schema: https://bscotch.github.io/stitch/artifacts/gamemaker/v2/releases.schema.json
- Browsable version: https://bscotch.github.io/stitch/gamemaker/releases

## Installation

`npm install @bscotch/gamemaker-releases`

## Usage

```ts
// Browser-compatible: fetch & validate the latest, already-compiled, unified feed
import { fetchReleasesFeed } from '@bscotch/gamemaker-releases/browser';

const { channels, releases } = await fetchReleasesFeed();
const latestLts = releases.find((r) => r.channels.includes('lts2026'));
console.log(latestLts?.version, latestLts?.runtime.version);
```

```ts
// Node: build the feed from scratch, straight from GameMaker's data
import {
  buildReleasesFeed,
  fetchFeedSources,
} from '@bscotch/gamemaker-releases';

// Throws if anything about GameMaker's data is unexpected
const feed = buildReleasesFeed(await fetchFeedSources());
```

## The Feed

Each entry in `releases` is an **IDE release**, unique by `version`, sorted newest first. The IDE details are at the entry's root, and the Runtime it pairs with is in `runtime`. See [`src/schemas.ts`](src/schemas.ts) (or the published JSON Schema) for full details.

```jsonc
{
  "version": "2026.1.0.27",
  "family": "2026.1.0",
  "channels": ["lts2026"],
  "publishedAt": "2026-11-16T10:48:23.000Z",
  "downloads": {
    "windows": "https://gms.yoyogames.com/GameMaker-Installer-2026.1.0.27.exe",
    "mac": "https://gms.yoyogames.com/GameMaker-2026.1.0.27.pkg",
    "linux": "https://gms.yoyogames.com/GameMaker-LTS2026-2026.1.0.27.deb",
  },
  "runtime": {
    "kind": "gms2",
    "version": "2026.1.0.28",
    "publishedAt": "2026-11-05T16:28:14.000Z",
    "channels": ["lts2026"],
    "feedUrl": "https://gms.yoyogames.com/Zeus-Runtime-LTS2026.rss",
  },
}
```

The feed also includes `channels`, metadata describing each release channel (see [`src/channels.ts`](src/channels.ts)). Consumers should use that metadata (e.g. `kind` and `status`) rather than hardcoding channel names, since new channels will be added over time (e.g. for each new LTS series).

| Channel    | Kind       | Status | Notes                                                                                            |
| ---------- | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| `lts2026`  | `lts`      | active | GameMaker's recommended channel                                                                  |
| `lts2022`  | `lts`      | frozen |                                                                                                  |
| `monthly`  | `monthly`  | frozen | The old "stable" channel. Only 2023.8+ is included.                                              |
| `beta`     | `beta`     | active | Uses Beta numbering: the minor version is 100x the stable version it becomes (2026.100 → 2026.1) |
| `unstable` | `unstable` | active | Every Beta release, plus many interim builds that are never promoted                             |

### IDE/Runtime pairing

IDE and Runtime versions share a `YEAR.MINOR.PATCH` "family", but have independent build numbers. None of GameMaker's feeds say which Runtime goes with which IDE, so the Runtime is inferred: it's the newest Runtime in the IDE's family, on the IDE's most stable channel, published no later than the IDE.

When checked against the pairings listed in GameMaker's [release notes](https://releases.gamemaker.io), this agreed with 74 of 75. Known exceptions are listed in [`src/overrides.ts`](src/overrides.ts). Add an entry there if the feed ever has a wrong pairing.

See [NOTES.md](NOTES.md) for more about how GameMaker publishes releases, and why this package works the way it does.

### GMRT

GameMaker's new runtime (GMRT) is out of scope for now. It is distributed via GameMaker's package manager rather than RSS feeds, and is not paired with specific IDE versions. The `runtime.kind` field is reserved for distinguishing it in the future.

## Legacy feed

The original feed (`https://bscotch.github.io/stitch/artifacts/gamemaker/releases-summary.json`) is frozen: it is still served for older versions of Stitch, but is no longer updated. The `@bscotch/gamemaker-releases/legacy` utilities for it have been removed; use the v2 feed instead.
