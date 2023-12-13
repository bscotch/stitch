# GameChanger Data

Our games use a JSON-Schema-like format to describe game content. This is used by our internal "GameChanger" tool.

This project contains parsers and helpers for GameChanger data.

*⚠️ This project is visible to the public, but will not be of any use to anyone besides Bscotch since our GameChanger tool is internal! ⚠️*

## Purpose

This project is intended to be used by other projects that need to read and write GameChanger data *outside* of the GameMaker context. For example, to create a VSCode extension for editing GameChanger data, or to create a web-based editor.

## Features

### Spell Check

Given a GameChanger project, we need to have spell-checking capabilities that take into account all of the made-up names and terms from the project, and that make it easy to modify allowed/disallowed terms.

The spellchecker starts with a base `en-US` dictionary, adds names of things found in the GameChanger data (when those names are localized), and then loads a final custom dictionary on top.

## Definitions

### "Packed" data

GameChanger data is bundled with the game as a "packed" JSON file that includes the motes, schemas, UUIds, and other data. This file is importable and exportable from the GameChanger, and represets the "truth" for a given game version.

### Schemas

A "BSchema" (a.k.a. "Schema") is a JSON-Schema-like document that describes the structure of a JSON object. It is used to validate and generate data for a given type of object, and to dynamically create an appropriate editor interface in the GameChanger.

The most fundamental difference between JSON Schema and Bschema is that Bschema avoids arrays. This is to simplify the process of diffing and merging data, since JSON pointers are used as identifiers and we need these to *not* change (a pointer to an array value will change if the order is changed, for example).

### Motes

A "Mote" is a JSON-compatible data structure whose "data" field is described by a Schema. Motes have additional metadata at the root level, for example to indicate their ID and matching Schema.

