# @bscotch/stitch-launcher Changelog

## 2.0.0 (2026-11-21)

### Breaking Changes

- Stitch Launcher has been completely overhauled, with a new function-based API (the old classes are gone). It now uses the v2 GameMaker releases feed, only uses IDEs from its own cache (ignoring your own GameMaker installs), and has a platform layer for Windows, macOS and Linux (macOS and Linux are implemented but untested).
- Stitch Launcher now installs IDE versions by downloading the official installer to your Downloads folder and extracting it with a user-installed full 7-Zip, instead of running the installer. Stitch never runs GameMaker installers. Missing 7-Zip or a missing Visual C++ runtime produce errors with instructions.
- Stitch Launcher no longer installs runtimes (the IDE installs its own on boot), and no longer edits runtime.json or runtime_feeds.json.
- Igor builds now use a self-cleaning cache in your OS's cache folder instead of `<project>/tmp/igor` (those old folders can be deleted), and their success is based on Igor's exit code.
- Stitch for VSCode now uses the v2 GameMaker release channels (lts2026, lts2022, monthly, beta, unstable). Existing channel settings are migrated automatically.
- Stitch for VSCode now suppresses GameMaker's update prompt by default when opening projects, and restores GameMaker's settings automatically.

### Docs

- Updated the Launcher Notes to remove all of the TODO stuff and just focus on how GameMaker installers and runners work, and explanations about why the Stitch Launcher works the way it does.

### Features

- Stitch Launcher can prune cached IDE versions, and flags versions that can no longer be downloaded.
- The parser can be given launcher options (e.g. a custom IDE cache folder) for finding GameMaker help docs and GML specs.
- Stitch for VSCode has new settings for the GameMaker IDE cache folder, the installer downloads folder, and the 7-Zip path, plus a "Prune Cached GameMaker Versions" command.

### Fixes

- Suppressing GameMaker's "IDE Update Available" prompt now only affects the launched channel, keeps a real backup, and restores your settings right after the IDE's startup update check. Leftovers from older Stitch versions are cleaned up automatically.
- Updated to continue using the legacy version of the unified releases feed (just to ensure things keep working until we update to use the new version).

## 1.7.1 (2026-01-09)

### Fixes

- Stitch now creates a backup of the current `default_macros.json` file before changing its contents, for manual recovery.

## 1.7.0 (2026-01-09)

### Features

- The Stitch launcher no longer disables GameMaker's update-available messages by default. You can opt into having it do this via a new setting when running the launcher, also available as a setting in Stitch for VSCode.

## 1.6.0 (2026-01-07)

### Features

- Updated all dependencies.

## 1.5.6 (2026-01-07)

### Fixes

- Added some more logging during loading to help triangulate slow-load and other issues.

## 1.5.5 (2026-01-07)

### Fixes

- Updated error message for case when user is not logged in to clarify that they need to log into the GameMaker IDE.

## 1.5.2 (2024-11-07)

### Fixes

- Prevented access errors during IDE discovery from fully throwing.

## 1.5.0 (2023-09-20)

### Features

- Bumped all deps

## 1.4.2 (2023-08-23)

### Fixes

- Resolved crash caused by invalid assumption that runtime_feeds.json will always exist

## 1.4.1 (2023-08-15)

### Fixes

- Updated all deps

## 1.4.0 (2023-07-10)

### Features

- Implemented calling the Igor Clean command

## 1.3.2 (2023-05-15)

### Fixes

- Resolved a circular dependency

## 1.3.1 (2023-05-03)

### Fixes

- Removed the quotes around the Igor command since that breaks the command on PowerShell.

## 1.3.0 (2023-05-02)

### Features

- Added a run command for GameMaker projects

## 1.2.2 (2023-04-12)

### Fixes

- Updated all deps, including a version of Pathy that was not properly using validators

## 1.2.1 (2023-04-11)

### Fixes

- Updating deps, resolving a typescript issue

## 1.2.0 (2023-03-31)

### Features

- Made cache and verbosity options available

## 1.1.0 (2023-03-30)

### Features

- Added additional functions related to generating Igor build commands
- Added functions for generating build command strings for use by 3rd party tools

## 1.0.4 (2023-03-06)

### Fixes

- Added fallback for um.json files, since they are not guaranteed to exist

## 1.0.3 (2023-03-06)

### Fixes

- Updated the homepage field in all manifests