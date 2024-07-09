# Crashlands 2 Editor Changelog

## 0.22.0 (2024-07-09)

### Features

- Added support for Notes and Stage information

### Fixes

- No longer displays an error message if Crashlands 2 is not found on disk

## 0.21.0 (2024-04-17)

### Features

- Removed comment features and highlighting from the editor config

## 0.20.0 (2024-03-09)

### Features

- Added glossary terms to autocompletes within free-form parts of storylines
- Added glossary terms to autocompletes within free-form text parts of quests

## 0.19.1 (2024-03-07)

### Fixes

- Resolved issue where non-object field changes were being deleted from the working copy.

## 0.19.0 (2024-02-19)

### Features

- Editor backups now track last-opened
- Editor backups now re-use matching backups, dramatically reducing noise

### Fixes

- Backups are now sorted by creation date
- Changed "Opened" to "Restored" in the backups picker

## 0.18.0 (2024-02-08)

### Features

- Added command to reload the glossary

## 0.17.0 (2024-02-08)

### Docs

- Added documentation for spellcheck.

### Features

- Changed spellcheck mechanism to use the new String Server

## 0.16.2 (2023-12-12)

### Fixes

- Added CL2 storylines as a separate "language" for convenience

## 0.16.0 (2023-12-06)

### Features

- Storylines are now included in the symbol search
- Storylines can now be edited in VSCode

## 0.15.0 (2023-12-06)

### Features

- Added context menu command to set a mote's folder
- Added context menu command for copying a folder's path

### Fixes

- Moving folders now causes all non-story/quest motes in that folder to also be moved

## 0.14.0 (2023-12-06)

### Features

- Implemented drag-drop of folders onto folders
- Implemented drag-drop of a folder onto a Mote
- Implemented drag-drop mote nesting
- Implemented drag-drop ordering of motes relative to other motes
- Added toggle for setting the drop mode in the tree

### Fixes

- Added back an autoreveal (only works if the item is already visible in the tree)

## 0.13.0 (2023-12-02)

### Features

- Editor now includes read-only listing of quest requirements, with autocompletes

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