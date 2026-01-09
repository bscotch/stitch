# @bscotch/stitch-launcher Changelog

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

## 1.3.3 (2023-05-15)

### Fixes

- Resolved a circular dependency

## 1.3.1 (2023-05-03)

### Fixes

- Removed the quotes around the Igor command since that breaks the command on PowerShell.

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