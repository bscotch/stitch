# GameMaker Releases

[GameMaker](https://gamemaker.io/) releases new builds fairly frequently across several release channels (e.g. beta, stable, and LTS). Each release includes two separate artifacts: an IDE installer and a Runtime.

This package centralizes all of the official GameMaker IDE and Runtime version information (for Windows versions) into a single structured document. It is used by [Butterscotch Shenanigans](https://www.bscotch.net) to keep an up-to-date, centralized history of releases for use in [Stitch for VSCode](https://marketplace.visualstudio.com/items?itemName=bscotch.bscotch-stitch-vscode) and other tools. These are uploaded [as GitHub releases](https://github.com/bscotch/gamemaker-info/releases).

> ⚠️ This package used to provide consolidated _release notes_ along with version information. GameMaker has since moved their release notes out of their feeds and into [a new site](https://releases.gamemaker.io/). The release note information provided by this package is therefore no longer useful!

This package is used to generate a summary, updated daily, which you can find at: https://bscotch.github.io/stitch/artifacts/gamemaker/releases-summary.json

## Requirements

- [Node.js 16+](https://nodejs.org)

## Installation

`npm install @bscotch/gamemaker-releases`

## Usage

```ts
import {
  fetchReleasesSummaryWithNotes,
  computeReleasesSummaryWithNotes,
} from '@bscotch/gamemaker-releases';

// 🚀 Fetch the latest already-computed summary
// of all GameMaker releases:
const releases = await fetchReleasesSummaryWithNotes();

// 🐌 Freshly compile the centralized release summary.
// This can be useful if the pre-computed
// summary is out of date.
const releases = await computeReleasesSummaryWithNotes();
```

## Background Info

### Artifacts

GameMaker releases are made up of a pair of artifacts: an IDE and a Runtime. While each IDE has a "matching" Runtime, you can specify any Runtime you want for the active IDE (though not all will work with any given IDE version).

The IDE artifacts are installed via an installer, while Runtimes are installed via the GameMaker IDE or via other installed Runtimes. In other words, you cannot manually install Runtimes.

### Release Channels

GameMaker artifacts are released into one or more of several channels. Each channel has a separate RSS feed describing the GameMaker versions available in that channel.

- **Long-Term Support (LTS)** Releases intended for maximum stability, with infrequent feature changes.
- **Stable** Releases intended for typical use-cases. The schedule is roughly monthly, and new features are delivered regularly.
- **Beta** Releases intended for games in early stages of production, where new and relatively-untested features are delivered rapidly. The schedule is roughly weekly.
- **Dev (Unstable)** Releases intended for internal use or rapid delivery of new features. Not recommended.

### Release Feeds

GameMaker releases are described by RSS feeds and JSON files whose URLs are listed inside those feeds. These RSS feeds are the same ones used by the GameMaker IDE to determine when new IDE and Runtime artifacts have become available.

There are distinct feeds for each platform supported by the GameMaker IDE, for each release channel. The IDE and Runtime have separate feeds.

#### IDE Feeds (Windows)

- `lts`: https://gms.yoyogames.com/update-win-LTS.rss
- `stable`: https://gms.yoyogames.com/update-win.rss
- `beta`: https://gms.yoyogames.com/update-win-NuBeta.rss
- `unstable`: https://gms.yoyogames.com/update-win-NuBeta-I.rss

#### Runtime Feeds (Windows)

- `lts`: https://gms.yoyogames.com/Zeus-Runtime-LTS.rss
- `stable`: https://gms.yoyogames.com/Zeus-Runtime.rss
- `beta`: https://gms.yoyogames.com/Zeus-Runtime-NuBeta.rss
- `unstable`: https://gms.yoyogames.com/Zeus-Runtime-NuBeta-I.rss
