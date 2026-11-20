# Design Notes

Background on how GameMaker publishes releases, and why this package works the way it does. Researched November 2026. GameMaker changes these things without notice, so treat specifics as "true when written" and update this file when they drift.

## GameMaker's sources

### RSS feeds

All feeds are RSS 2.0 at `https://gms.yoyogames.com/<name>.rss`. Items are listed **oldest first**, old items are never removed, and each item's `<title>` is `Version Y.M.P.B`.

| Channel    | IDE feeds                         | Runtime feeds                            | Status                       |
| ---------- | --------------------------------- | ---------------------------------------- | ---------------------------- |
| `lts2026`  | `update-{win,mac,linux}-LTS2026`  | `Zeus-Runtime-LTS2026`                   | Active (GameMaker's default) |
| `beta`     | `update-{win,mac,linux}-NuBeta`   | `Zeus-Runtime-NuBeta`                    | Active                       |
| `unstable` | `update-{win,mac,linux}-NuBeta-I` | `Zeus-Runtime-NuBeta-I`                  | Active                       |
| `monthly`  | `update-{win,mac}`                | `Zeus-Runtime`                           | Frozen since March 2026      |
| `lts2022`  | `update-{win,mac}-LTS`            | `Zeus-Runtime-LTS`, `Zeus-Runtime-LTS-I` | Frozen                       |

Ignored: `update-win-Beta` / `Zeus-Runtime-Beta` (2.2.x era, frozen since 2019).

What the feed items contain:

- **IDE items** have a `pubDate` and an installer link, in either `<link>` or `<enclosure url>`. Their release notes are now empty, and **no IDE feed says which runtime goes with the IDE.**
- **Runtime items** use the [Sparkle](https://sparkle-project.org/) "appcast" format, an RSS extension from a macOS auto-update framework. Each item holds one core zip plus one `<module>` per target and host OS. Runtimes are **platform-agnostic**, so one runtime feed serves IDEs on every OS.

How the feeds overlap:

- Every Beta IDE build also appears in Unstable. So IDE releases are merged by version, and each release lists all of its `channels`.
- 2026.0.0.16 appears in both LTS feeds.
- The Linux Unstable feed has a few builds the Windows feed lacks.
- The **same version can have different `pubDate`s across feeds**, by up to about 6 days. We use the earliest.
- The Monthly releases from 2023.8 through 2024.14.4 exist **only** in the Monthly feeds. That's why `monthly` is kept as a frozen channel.

### Release notes (not used)

GameMaker's release notes site, https://releases.gamemaker.io, is built from markdown files in [`YoYoGames/GameMaker-Bugs/docs/release-notes/<dir>/<minor>[_<patch>].md`](https://github.com/YoYoGames/GameMaker-Bugs/tree/main/docs/release-notes). They're the only official source of IDE/Runtime pairings, but are hand-written and sparse. In practice, inferred pairings based just on feed data are nearly always correct.

### GMRT (out of scope)

GameMaker's new runtime (GMRT) is distributed through GameMaker's package manager, using an npm registry at `gmrt-gmpm.gamemaker.io` (package `@gmrt-group-release-<platform>/gmrt`). It is **not** distributed through the RSS feeds.

- No IDE↔GMRT pairing is published anywhere.
- GameMaker says the package manager "aims to decouple the IDE and allow game projects to specify their version". So GMRT is likely to become something each project pins, not something paired with an IDE.
- Every IDE in scope still pairs with a classic ("GMS2") runtime.
- `runtime.kind` exists so GMRT can be added later without a breaking change.

## Version numbers

The format is `YEAR.MINOR.PATCH.BUILD`:

- **IDE and Runtime builds are numbered separately.** They only share the `YEAR.MINOR.PATCH` "family". An IDE only accepts runtimes from its own family. Since LTS2026, it also accepts newer runtimes from that family, not just the original one.
- **Beta numbering:** a Beta's MINOR is the MINOR of the stable release it becomes, times 100. For example, 2024.1400 became 2024.14, and 2026.100 became LTS 2026.1. `GameMakerVersionString.isBetaNumbering()` detects this (year ≥ 2022 and minor ≥ 100).
- **YEAR is not strictly a date.** The Monthly channel kept using `2024.` well into 2026.
- **Malformed versions exist.** For example, `2024.06.2.162` has a leading zero. Versions are normalized when they're parsed.
- **There's no meaningful order across channels.** Releases are sorted by publish date, then by raw numeric comparison.
- **Some patch releases are IDE-only.** For example, 2024.6.2.162 has no 2024.6.2 runtime.

The version helpers live in [`@bscotch/yy/version`](../yy/src/types/GameMakerVersionString.ts), which has no dependencies.

## Pairing

For each IDE release, the runtime comes from [`src/overrides.ts`](src/overrides.ts) if the IDE is listed there. Otherwise it's inferred in three steps:

1. Take the runtimes in the IDE's family. If there are none, take the nearest lower-patch family with the same `Y.M`.
2. Narrow those to runtimes on the IDE's most stable channel. This keeps an Unstable-only runtime from being chosen for a Beta IDE.
3. Pick the newest one published no later than the IDE. If there's none, pick the oldest.

When this was written, inference agreed with 74 of the 75 pairings in the release notes. The one mismatch, 2024.11.0.179, got a runtime update after the IDE was released, which inference can't predict. It's in the overrides.

Each rule was added to fix specific mismatches against the release notes:

- The lower-patch fallback is for IDE-only patch releases like 2024.6.2.
- The stable-channel preference fixed 2024.1400.4.1023.
- Allowing runtimes published a few days _after_ the IDE always made agreement worse.

## Output, and why it's shaped this way

- **One entry per IDE version**, with a `channels` array. IDE versions are unique, but `family` is not: 2026.100.0 alone covers more than 100 builds.
- **IDE fields sit at the entry's root, and the runtime is nested under `runtime`.**
- **The root is an object, not an array,** so it can carry `$schema` and the channel metadata.
- **One channel per LTS series** (`lts2022`, `lts2026`, and later `lts2028`…). This matches GameMaker, which gives each LTS its own feeds and its own install directory.
- **Channel names are validated by pattern, not by enum.** That way installed clients won't reject new channels. Consumers should drive their logic from the channel `kind`/`status` metadata.
- **Coverage is limited** to Monthly 2023.8 and later (via `minVersion`), plus everything in the LTS, Beta, and Unstable feeds.
- **Install directories:** `channels[].userDirSuffix` records how GameMaker names its user directories, e.g. `%APPDATA%/GameMakerStudio2<suffix>`. LTS2026 uses `-LTS2026`, not `-LTS` ([#306](https://github.com/bscotch/stitch/issues/306)). Only Windows has been verified; macOS and Linux have not.
- **Nothing is cached.** A build fetches about 20 RSS feeds, which is cheap.

## Detecting GameMaker changes

The feed is built by [`packages/site/scripts/update-unified-feed.mjs`](../site/scripts/update-unified-feed.mjs) in the `publish-stitch-site` workflow. **Any error blocks publishing and posts an alert to Discord.** The last good feed stays live in the meantime.

| Error                                                      | Likely cause                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A feed fails to fetch, is empty, or has unparseable titles | A feed was renamed or removed, or its format changed                                             |
| `Channel "<name>" has no IDE releases`                     | Feed URLs changed. Check GameMaker's download page and the IDE's update settings.                |
| `Could not find a runtime` for an IDE                      | A new channel's runtime feed is missing from `channels.ts`, or the family/version scheme changed |
| A pairing override references an unknown IDE or runtime    | A typo in `overrides.ts`, or GameMaker removed a release from its feeds                          |

Things that can only be caught by watching for them:

- **Wrong pairings.** Spot-check new LTS and Beta releases against the release notes now and then, especially if GameMaker starts shipping runtime-only updates, and add overrides as needed.
- **A new LTS series**, or any other new channel. Add an entry to [`src/channels.ts`](src/channels.ts) and freeze the old one by setting its `status`.
- **New GMRT developments**, in particular per-project version pinning.
