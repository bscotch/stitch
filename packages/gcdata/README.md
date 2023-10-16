# GameChanger Data

Our games use a JSON-Schema-like format to describe game content. This is used by our internal "GameChanger" tool.

This project contains parsers and helpers for GameChanger data.

*NOTE: This project is visible to the public, but will not be of any use to anyone besides Bscotch since our GameChanger tool is internal!*

## Purpose

This project is intended to be used by other projects that need to read and write GameChanger data *outside* of the GameMaker context. For example, to create a VSCode extension for editing GameChanger data, or to create a web-based editor.

### Features
 
- [ ] Typescript types for modeling GameChanger data
- [ ] Reader for packed data
- [ ] Helpers for updating GameChanger data while generating changelogs for ingest by the actual GameChanger tool

## Definitions

### "Packed" data

GameChanger data is bundled with the game as a "packed" JSON file that includes the motes, schemas, UUIds, and other data. This file is importable and exportable from the GameChanger, and represets the "truth" for a given game version.

### Schemas

A "BSchema" (a.k.a. "Schema") is a JSON-Schema-like document that describes the structure of a JSON object. It is used to validate and generate data for a given type of object, and to dynamically create an appropriate editor interface in the GameChanger.

The most fundamental difference between JSON Schema and Bschema is that Bschema avoids arrays. This is to simplify the process of diffing and merging data, since JSON pointers are used as identifiers and we need these to *not* change (a pointer to an array value will change if the order is changed, for example).

### Motes

A "Mote" is a JSON-compatible data structure whose "data" field is described by a Schema. Motes have additional metadata at the root level, for example to indicate their ID and matching Schema.

