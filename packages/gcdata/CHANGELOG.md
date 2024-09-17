# @bscotch/gcdata Changelog

## 0.22.0 (2024-09-17)

### Features

- Stringified character data can now be used to update GameChanger data
- Can now parse stringified character motes
- Can now stringify character motes

## 0.21.2 (2024-09-16)

### Fixes

- Resolved issue where folders inside Motes would not nest properly

## 0.21.1 (2024-07-15)

### Fixes

- Resolved issue where an empty Quest log could stringify as 'undefined'

## 0.21.0 (2024-07-10)

### Features

- The CL2 editor now shows all motes and allows editing Comforts
- Added support for Buddy Comforts

## 0.20.1 (2024-07-09)

### Fixes

- Resolved issue with absent "Stage" fields preventing saving

## 0.20.0 (2024-07-09)

### Features

- Added support for Notes and Stage information
- Updated CL2 types inferred from GameChanger

### Fixes

- Updated deps

## 0.19.0 (2024-04-17)

### Features

- Removed comments and WIP content from the Quest/Storyline parser/stringifier
- Updated CL2 types

## 0.18.0 (2024-03-09)

### Features

- Added glossary terms to autocompletes within free-form parts of storylines
- Added glossary terms to autocompletes within free-form text parts of quests

## 0.17.3 (2024-03-07)

### Fixes

- Resolved issue where non-object field changes were being deleted from the working copy.

## 0.17.2 (2024-02-19)

### Fixes

- Resolved issues caused by incomplete object deletions

## 0.17.1 (2024-02-09)

### Fixes

- Resolved some issues causing schema pointer-resolution failures

## 0.17.0 (2024-02-08)

### Features

- Changed spellcheck mechanism to use the new String Server

## 0.16.0 (2024-01-18)

### Features

- Added a 'priorReturn' argument to Mote data visitors, for easier accumulationg of data along a path
- Changed the MoteVisitor to use the full context as the parent to allow for working back up the tree

## 0.14.3 (2024-01-04)

### Fixes

- Resolved issue where bsArray keys could be all-numeric

## 0.14.2 (2023-12-13)

### Fixes

- Made gcdata public so it can be easily used in other projects

## 0.14.1 (2023-12-12)

### Fixes

- Resolved infinite loop caused by improper type checking of Bschema objects
- Moved quest giver/receiver after the quest requirements instead of at the top

## 0.14.0 (2023-12-08)

### Features

- Added a GCData mote-data-visitor method to simplify gcdata tasks

## 0.13.0 (2023-12-06)

### Features

- Storylines can now be edited in VSCode

## 0.12.0 (2023-12-06)

### Features

- Added method for getting the ancestry of a mote
- Added method for changing a mote's GameChanger location

## 0.11.0 (2023-12-04)

### Features

- Requirements are now parsed and saved to changes

## 0.10.0 (2023-12-02)

### Features

- Editor now includes read-only listing of quest requirements, with autocompletes

### Fixes

- Remove dictionary-rebuild on save, since that is very costly for perf

## 0.9.0 (2023-11-30)

### Features

- Added all parsed words to results to enable finding a word given a cursor position
- Added spellcheck functionality to the quest parser

### Fixes

- Added build step to remove cjs-incompatible dictionary-en import
- Resolved several issues causing fragility of schema pointer resolution

## 0.8.1 (2023-11-29)

### Fixes

- Added support for commas and parens for mote names
- Resolved issues causing error-on-save with new moment content.

## 0.8.0 (2023-11-14)

### Features

- Quest renames are now reflected in the tree
- On save to change.json, a backup is now always made
- Updated CL2 types
- Now creating the changes file if it doesn't already exist, instead of relying on the GameChanger to do so
- Implemented saving of Quest Moment changes
- Changes Clues are now fully saved

### Fixes

- Changed the changes.json backup to backup the old file instead of the new one, to prevent losing changes written by GameChanger

## 0.7.0 (2023-11-08)

### Features

- Changes via the Quest Editor can now sync properly to the GameChanger changes file
- Implemented BsArray ordering

## 0.6.1 (2023-11-01)

### Fixes

- Resolved misc. errors

## 0.6.0 (2023-10-31)

### Features

- Now loading GameChanger data from draft files

## 0.5.1 (2023-10-30)

### Fixes

- Resolved some parsing issues

## 0.5.0 (2023-10-30)

### Features

- Completed initial autcompletes, diagnostics, and parsing

## 0.4.0 (2023-10-27)

### Features

- Added emoji autocompletes
- Implemented 'comments' as notes

### Fixes

- Updated CL2 types

## 0.3.0 (2023-10-25)

### Features

- Added autcompletes for giver/receiver/storyline, and added diagnostics for missing motes
- Added completions for global labels

### Fixes

- Added @-triggered completion that displays all motes if none were otherwise provided

## 0.2.0 (2023-10-24)

### Features

- Now supporting autocomplete for speaker names
- Added improved onEnter behavior in the Quest editor
- Now auto-adding new array tags

## 0.1.2 (2023-10-18)

### Fixes

- Completed initial syntax highlighting and on-enter behavior

## 0.1.1 (2023-10-18)

### Fixes

- Small tweaks to text version of quests