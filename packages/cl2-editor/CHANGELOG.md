# Crashlands 2 Editor Changelog

## 0.12.0 (2023-11-30)

### Features

- Now showing spellcheck warnings in the editor

### Fixes

- Autcomplete of 'other' moment types now only prefixes the result with '?' if at the start of the line

## 0.11.0 (2023-11-29)

### Features

- Added workspace symbol search for CL2 quest names and ids

## 0.10.1 (2023-11-15)

### Fixes

- Resolved issue with the listed VSCode engine version

## 0.10.0 (2023-11-15)

### Features

- Implemented drag-drop organization of quests within stories
- The focused quest is now always revealed in the tree.
- Quest renames are now reflected in the tree

## 0.9.0 (2023-11-08)

### Features

- Implemented file Quest Editor saving
- Added a parse delay to prevent weird stuff from happening on auto-insertion of tags etc

## 0.8.1 (2023-11-01)

### Fixes

- Resolved Quest editor issues caused by changes to the parser

## 0.8.0 (2023-10-31)

### Features

- Now loading GameChanger data from draft files

## 0.7.0 (2023-10-30)

### Features

- Added backups and a restore command for edited quests

## 0.6.1 (2023-10-30)

### Fixes

- Resolved some parsing issues

## 0.6.0 (2023-10-30)

### Features

- Completed initial autcompletes, diagnostics, and parsing

## 0.5.0 (2023-10-27)

### Features

- Added emoji autocompletes

## 0.4.0 (2023-10-25)

### Features

- Added autcompletes for giver/receiver/storyline, and added diagnostics for missing motes
- Added completions for global labels

### Fixes

- Added @-triggered completion that displays all motes if none were otherwise provided

## 0.3.0 (2023-10-24)

### Features

- Now supporting autocomplete for speaker names
- Added improved onEnter behavior in the Quest editor
- Now auto-adding new array tags

## 0.2.3 (2023-10-18)

### Fixes

- Completed initial syntax highlighting and on-enter behavior

## 0.2.2 (2023-10-18)

### Fixes

- Extension is now publishable.

## 0.2.1 (2023-10-18)

### Fixes

- Resolved incorrect ending version and bumped patch deps

## 0.2.0 (2023-10-18)

### Features

- Crashlands Editor extension first draft ready for deployment