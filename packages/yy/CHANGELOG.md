# @bscotch/yy Changelog

## 2.7.0 (2026-01-07)

### Features

- Updated all dependencies.

## 2.6.1 (2025-08-18)

### Fixes

- SVG sprite types will no longer error on load

## 2.6.0 (2025-08-08)

### Features

- Added a function to create audio and texture groups in a GameMaker yyp file.
- Added a function for upserting scripts in a GameMaker project.
- Added GameMaker project version-setting via the Yy package, including a CLI command.

### Fixes

- Fixed the yy CLI to ensure it behaves as an ESM file

## 2.5.0 (2025-08-07)

### Features

- Added support for the Sound yy format update in GameMaker 2024.1400.0.815

### Fixes

- Added support for converting Sound yy files to the 2024.1400+ version during stringification.
- Improved handling of sparse Sound yy data
- Updated all yy package deps
- Updated the Yy project to use Zod4, which required tuning up many schemas.

## 2.4.0 (2025-06-05)

### Features

- Added basic support for parsing RoomUI yy files

## 2.3.2 (2025-05-06)

### Fixes

- Writing Script yy files for GM versions > 2024.8 now sets the version to v1 to avoid errors in recent GameMaker runtimes

## 2.3.1 (2024-11-04)

### Fixes

- Added the Spine Collision Mesh enum option for Sprite Collisions

## 2.3.0 (2024-10-18)

### Features

- Added utility class for working with GameMaker version strings

### Fixes

- Updated YY-writing to add set file versions to 'v1' for some fields, to resolve issue with recent GameMaker format changes

## 2.2.1 (2024-04-29)

### Fixes

- Resolved an issue where the "%Name" field was not always deleted from new sprite tracks

## 2.2.0 (2024-03-08)

### Features

- Changed defaults to better match our typical use cases

### Fixes

- Improved defaults for new yy files for compatibility with latest GameMaker

## 2.1.8 (2024-03-06)

### Fixes

- Further improved detection of integer-like values for casting as BigInts

## 2.1.7 (2024-03-06)

### Fixes

- Resolved issue where values like 1E-10 were being interpreted as BigInts instead of as floats

## 2.1.6 (2024-03-06)

### Fixes

- The '%Name' field is now always set to the 'name' field value, even when it was already set. This ensures that name-changing logic can work.
- Resources, folders, and Included Files are now all sorted during stringification for the new GameMaker project format.

## 2.1.5 (2024-02-22)

### Fixes

- Now ensuring that '%Name' is definitely not in $GMSpriteFramesTrack objects

## 2.1.4 (2024-02-22)

### Fixes

- Changed yy line endings to be LF instead of CRLF for the new format

## 2.1.3 (2024-02-22)

### Fixes

- Fixed formatting of 'ConfigValues' entries to match the new format

## 2.1.2 (2024-02-21)

### Fixes

- Resolved sorting issue in older project format

## 2.1.1 (2024-02-21)

### Fixes

- Updated yy stringification to match the latest new format

## 2.1.0 (2024-02-17)

### Features

- Can now add shader assets

## 2.0.0 (2024-02-13)

### Features

- Re-updated YY stringification logic to account for additional changes to the new format
- Added support for GameMaker project format whose runtime is 2024.200.0.508+, and removed support for 2024.200.0.490.

## 1.0.2 (2024-01-29)

### Fixes

- Added missing Texture Groups field from the new project format

## 1.0.1 (2024-01-29)

### Fixes

- Resolved issues with key order in new project format

## 1.0.0 (2024-01-29)

### Features

- Added support for the new GameMaker project format

## 0.17.1 (2024-01-17)

### Fixes

- YYP files now strip out the Options field if it is an empty array

## 0.17.0 (2023-12-07)

### Features

- When yy files are being written, they now default to the key order that latest GameMaker uses. If the file already exists, the existing file's key order will still be used. Collectively this should reduce git noise and conflicts.

### Fixes

- The 'Options' field is now properly set to optional, so that Stitch doesn't constantly re-add it.

## 0.16.0 (2023-12-02)

### Features

- Added passthrough room layer schema for 'GMREffectLayer' types

## 0.15.2 (2023-10-30)

### Fixes

- Resolved issue where object 'listItems' was not allowed to be null

## 0.15.1 (2023-10-18)

### Fixes

- Allow Room Layer pathId fields to be null

## 0.15.0 (2023-09-25)

### Features

- Added support for GMFolderLayer sprite layers

## 0.14.0 (2023-09-20)

### Features

- Bumped all deps

## 0.13.0 (2023-08-28)

### Features

- Resolved issue where new sprites do not have a centered origin, and defaulted the origin type to "Custom"

## 0.12.1 (2023-08-15)

### Fixes

- Updated all deps
- Loosened the restrictiveness of the bitRate field in sound yy files

## 0.12.0 (2023-07-14)

### Features

- Added a schema for extension yy files

### Fixes

- Updated type names for consistency

## 0.11.2 (2023-07-12)

### Fixes

- Added support for room layer Path and Layer types

## 0.11.1 (2023-07-11)

### Fixes

- Now exporting the schema for object event metadata
- Resolved issues related to Room schemas

## 0.11.0 (2023-07-11)

### Features

- Added schema information for tiled room layers

### Fixes

- Added more schema info for tiled room layers

## 0.10.1 (2023-06-16)

### Fixes

- Resolved types issue and updated some deps

## 0.10.0 (2023-06-16)

### Features

- Added ability to create scripts via the sidebar
- Added the ability to add folders via the Stitch sidebar
- Added new Room fields

### Fixes

- Added object schema entry for new field

## 0.8.1 (2023-04-12)

### Fixes

- Updated all deps, including a version of Pathy that was not properly using validators

## 0.8.0 (2023-04-11)

### Features

- Added basic support for the new 'particle' resource type

## 0.7.0 (2023-03-11)

### Features

- Now exporting all YY types

### Fixes

- Made the 'order' field optional for yyp files to reflect the latest GameMaker versions

## 0.6.2 (2023-03-06)

### Fixes

- Updated the homepage field in all manifests