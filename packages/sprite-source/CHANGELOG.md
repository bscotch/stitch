# @bscotch/sprite-source Changelog

## 0.4.5 (2023-11-01)

### Fixes

- Added traces and extra safety mechanisms to sprite-actions

## 0.4.1 (2023-09-20)

### Fixes

- Now ensuring that SpriteDest import calls are sequential to prevent race conditions

## 0.4.0 (2023-09-20)

### Features

- Bumped all deps

### Fixes

- Resolved issues caused by dependency updates

## 0.3.0 (2023-09-13)

### Features

- Exposed more of the API

## 0.2.5 (2023-09-13)

### Fixes

- Resolved issue where cumulative checksums were incorrect, causing all images to appear to be "changed"

## 0.2.4 (2023-09-13)

### Fixes

- Improved error logs and resolved an issue when importing sprites

## 0.2.3 (2023-09-12)

### Fixes

- Resolved issue with absolute sprite-source paths being treated as relative
- Improved a progress message

## 0.2.2 (2023-09-12)

### Fixes

- Resolved issues with loading/saving sprite yy files
- Resolved issue where re-importing sprites would cause an error message
- Moved PNG checksum calculation into a Rust package

## 0.2.1 (2023-09-11)

### Fixes

- Removed sharp for now until I can figure out how to get it bundled with the vscode extension

## 0.2.0 (2023-09-08)

### Features

- Completed implementation of the sprite-source module
- Added a VSCode-compatible reporter option to imports
- Completed draft of the sprite-source module
- Implemented 'ignore' options for SpriteSources.
- SpriteSource images now have their info updated
- Staged images are now fully processed and added to SpriteSource folders

### Fixes

- Resolved some issues with reading/writing yyp files
- Resolved issue with config-loading being too stringent