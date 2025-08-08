# @bscotch/stitch-config Changelog

## 0.5.0 (2025-08-08)

### Features

- Added functions for loading/saving/init-ing config files, and for syncing audio and texture group assignments with the config

### Fixes

- Updated JSON Schema for Stitch Configs

## 0.4.1 (2025-08-07)

### Fixes

- Resolved issue caused by regression in Zod4, causing configs to error out if they have the key "constructor" in them.
- Bumped config's dependencies and replaced external zod-to-json-schema with native one in Zod4

## 0.4.0 (2024-03-07)

### Features

- Added support for styling runner logs

## 0.3.0 (2024-02-23)

### Features

- Added helper functions for checking asset name validity

## 0.2.0 (2024-02-22)

### Features

- Added the Stitch config schema URL and ID
- Added a new package for the stitch config file, to make it easier to manage