# @bscotch/stitch Changelog

## 10.10.0 (2024-01-17)

### Features

- When Stitch Core sets the game version in options files, it now skips Switch since GameMaker now removes that version key.

## 10.9.7 (2023-12-07)

### Fixes

- Resolved issue caused by the yyp "Options" field now being optional

## 10.9.0 (2023-09-20)

### Features

- Bumped all deps

### Fixes

- Resolved issues caused by dependency updates

## 10.8.0 (2023-08-30)

### Features

- Added plugin hooks for before/after individual sprite additions
- Added plugin functions for before/after batch-add of sprites, and for before individual sprite-add

## 10.7.0 (2023-08-28)

### Features

- Resolved issue where new sprites do not have a centered origin, and defaulted the origin type to "Custom"

## 10.6.15 (2023-08-15)

### Fixes

- Updated all deps

## 10.6.11 (2023-07-11)

### Fixes

- Resolved type issue causing build failure

## 10.6.7 (2023-06-16)

### Fixes

- Resolved types issue and updated some deps

## 10.6.2 (2023-04-12)

### Fixes

- Updated all deps, including a version of Pathy that was not properly using validators

## 10.6.0 (2023-04-11)

### Features

- Added basic support for the new 'particle' resource type

## 10.5.3 (2023-03-13)

### Docs

- Updated Stitch Core readme to add more 'await's and to remove the legacy linter stuff
- Updated Stitch Core docs to use the new 'StitchProject' name instead of 'Gms2Project', and to show loading using the new async API.

## 10.4.8 (2023-03-06)

### Fixes

- Resolved local dependency issues

## 10.4.7 (2023-03-06)

### Fixes

- Added fallback for um.json files, since they are not guaranteed to exist

## 10.4.6 (2023-03-06)

### Fixes

- Updated the homepage field in all manifests
- Removed warning from docs regarding repo not being public, now that it is