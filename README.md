# GMS2 Project Automater

## TODOs

+ Figure out what the "order" field does for Resources
  + May be important for rooms, if not anything else
+ Figure out what the "order" field does for Folders
+ Does config impact texture/audiogroup target assignment?
+ For texturegroups, what values do we need to be able to specify for:
  + "isScaled":true
  + "autocrop":true
  + "border":2
  + "mipsToGenerate":0

## Game Project File Structure & Content

### General File Information

#### File types

The main organizational content of a Gamemaker project is in JSON-like files,
typically with extensions `.yyp` or `.yy`. In GMS2.3 these files have trailing
commas (meaning standard JSON parsers cannot read them) and can have Int64 values
(depending on parsing language, meaning data will be lost during save/load).

Each resource, of any type, typically includes a `.yy` file and may also include
files of various resource-specific types.

## Folders

+ "Groups" (folders) in GMS2.3 do not also create folders in the local
  file structure.
+ Every resource ends up in a flat file structure inside a per-resource-type root folder.
+ There is one file folder per resource type.
+ Organization of resource files within each resource folder seems to be unchanged relative
  to GMS2.2. *Mosty* conists of `type/name/name.yy`, sometimes with additional files of various types.

#### Tags

In GMS2.3 resources, folders, etc can have tags. These are used for filtering
content in the resource tree. They are always present as a "tags" field with a
simple list of strings.

#### Colors

???



### YYP

Each game project has a root `*.yyp` file that describes all of its resources
and some of its high-level metadata. This is the entrypoint for Gamemaker projects.

The root contents of the GMS2.3 `yyp` file are these:

+ `resources`: Lists resources of every type except for folders, options, included files, texture groups, and audio groups
  + example entry: `{"id":{"name":"object","path":"objects/object/object.yy",},"order":4,}`
  + (note the complete absence of IDs)
  + (note trailing commas)
  + (note the use of POSIX-style path separators)
+ `Options`: Example `{"name":"Amazon Fire","path":"options/amazonfire/options_amazonfire.yy",}`
+ `configs`: Example:

```json
{
  "name": "Default",
  "children": [
    {"name":"steam","children":[],},
    {"name":"ps5","children":[],},
  ],
}
```

+ `RoomOrder`: `[{"name":"the_room","path":"rooms/the_room/the_room.yy",}]`
+ `Folders`: `{"folderPath":"folders/sample_resources/level2/level3.yy","order":1,"resourceVersion":"1.0","name":"level3","tags":[],"resourceType":"GMFolder",}`
  + (resourceType is always GMFolder)
  + (resourceVersion is always "1.0")
+ `AudioGroups`: Example `{"targets":461609314234257646,"resourceVersion":"1.0","name":"audiogroup_default","resourceType":"GMAudioGroup",}`
  + (always type "GMAudioGroup")
  + (always "resourceVersion":"1.0")
  + The targets list is binary mask of some sort identify platforms
+ `TextureGroups`: Example `{"isScaled":true,"autocrop":true,"border":2,"mipsToGenerate":0,"targets":461609314234257646,"resourceVersion":"1.0","name":"Default","resourceType":"GMTextureGroup",}`
  + (always type "GMTextureGroup")
  + (always "resourceVersion":"1.0")
  + The targets list is binary mask of some sort identify platforms
+ `IncludedFiles`: Example `{"CopyToMask":-1,"filePath":"datafiles/level_1","resourceVersion":"1.0","name":"discoverable_datafile.txt","resourceType":"GMIncludedFile",}`
  + (always type "GMIncludedFile")
  + (always "resourceVersion":"1.0")
  + "CopyToMask":-1 means "deploy to all targets". We use different masks based on config and target platform.



## Contributing

### Commit conventions

We follow the conventional-changelog Angular convention for commit messages,
namely formatting them as `<type>(<scope>): <subject>` where `type` is one of:

+ feat: A new feature
+ fix: A bug fix
+ docs: Documentation only changes
+ style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
+ refactor: A code change that neither fixes a bug nor adds a feature
+ perf: A code change that improves performance
+ test: Adding missing or correcting existing tests
+ chore: Changes to the build process or auxiliary tools and libraries such as documentation generation
