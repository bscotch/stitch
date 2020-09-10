# Gamemaker Studio 2 Pipeline Development Kit (GMS2 PDK)

Gamemaker Studio 2 (GMS2) is a powerful game-making tool, but it does not generally have pipeline features for managing assets. This package provides a collection of modules and command-line tools for automating tasks in GMS2 by directly managing its project files, and is developed by [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch").

<b style="color:red">DANGER:</b> This toolkit's purpose is to externally modify your Gamemaker Studio 2 project files. This comes with enormous risk: any external changes made to your project may completely and permanently break your project. **DO NOT USE THIS TOOLKIT** unless you are using version control and have committed any important changes beforehand.

**NOTE:** This toolkit only works for projects from GMS2 versions >= 2.3. GMS2 Versions <2.3 have a completely different file structure and are not at all compatible with this tool.

## Core Features

### Gamemaker Modules

Gamemaker Studio has mechanisms to import assets from one Gamemaker project into another, as well as an "extensions" system, but this can be unwieldy to manage. We use a custom solution for this that we simply call "Modules". A "module" is a collection of assets that have a common folder name in their path. For example, for a module called "TitleScreen" and an asset heirarchy including:

+ `sprites/TitleScreen/{module content}
+ `sounds/menus/TitleScreen/{module content}

Everything inside those two groups, starting at the "TitleScreen" level and recursing through any subgroups, is included as a "TitleScreen" asset and can be imported together into another Gamemaker 2 project. In effect, the import first **deletes** all "TitleScreen" assets in the target and then clones all "TitleScreen" assets from the source, guaranteeing that your source and target projects will have exactly matching resources within the "TitleScreen" module.

At Bscotch, we have a separate Gamemaker project for our shared asset library, including our login system, a large script library, common objects, and more. We use the module system to import this shared library into all of our games. This makes it easy to maintain shared assets and to start new projects with a huge head start.

#### Module Import Notes

+ Local texture page assignments are *not* overwritten when importing sprites. If the local sprite does not exist, or does exist but is assigned to a non-existent texture page, the source's texture page will be created locally and used by the imported sprite.

### External Asset Importers

Managing art, audio, and file assets can be quite painful. These things should always be part of some sort of pipeline, but GMS2 does not provide built-in pipeline tooling. This SDK provides mechanisms to import external content into GMS2 projects, so that you can build pipelines appropriate to your technology stack.

For example, if your audio team dumps their files into a shared dropbox folder, you can use the CLI to batch-import from that folder. This will update all existing sound assets and add any new ones, using the filenames as Gamemaker assets names. No manual steps required!

Or, if you have a content server storing images, sounds, or files, you can write a script to automatically import all up-to-date versions of those assets into your project.

At Bscotch, we use importers for our sound, art, and localization pipelines, so that our game programmers do not need to manually find, import, or name assets created by other team members.

#### Asset Import Notes

+ Local texture page assignments are *not* overwritten when updating sprites. If the local sprite does not exist, or does exist but is assigned to a non-existent texture page, the source's texture page will be created locally and used by the imported sprite.

### Texture Page Management

Texture page assignment of sprites is a fully manual process, and there is no way to do it in batch via the GMS2 IDE.

The Pipeline SDK allows you to create a Texture Page Assignment configuration file that maps project folders to textures. For example, you might map `mainMenu/` to `mainMenuTexturePage`, so that *every* sprite inside that folder will be put into the same texture page.

(Note that this won't happen automatically -- you'll need to run a command to cause all texture assignments in the project to be updated according to the config.)

### Audio Group Management

Audio Groups suffer the same manual problems as Texture Pages, and the Pipeline SDK solves this in the same way.

## TODOs

+ Lay out the feature set that this thing needs to have
+ Figure out what questions remain to understand the complexity of completing that feature set
+ How are texture pages and assignments stored?
+ Figure out what the "order" field does for Resources
  + May be important for rooms, if not anything else
+ Figure out what the "order" field does for Folders
+ Does config impact texture/audiogroup target assignment?
+ For texturegroups, what values do we need to be able to specify for:
  + "isScaled":true 
  + "autocrop":false 
  + "border":2
  + "mipsToGenerate":0 // don't care about this
  + MANUALLY HANDLED

## Game Project File Structure & Content

### General File Information

#### File types

The main organizational content of a Gamemaker project is in JSON-like files,
typically with extensions `.yyp` or `.yy`. In GMS2.3 these files have trailing
commas (meaning standard JSON parsers cannot read them) and can have Int64 values
(depending on parsing language, meaning data will be lost during save/load).

Each resource, of any type, typically includes a `.yy` file and may also include
files of various resource-specific types.

#### Folders

+ "Groups" (folders) in GMS2.3 do not also create folders in the local
  file structure.
+ Every resource ends up in a flat file structure inside a per-resource-type root folder.
+ There is one file folder per resource type.
+ Organization of resource files within each resource folder seems to be unchanged relative
  to GMS2.2. *Mosty* conists of `type/name/name.yy`, sometimes with additional files of various types.
+ Which folder an asset is in is determined by that asset's `.yy` file via the `"parent"` field.

Examples:

```jsonc
// For assets in the root level (no parent folder)
// (Just refers to the project itself)
"parent": {
  "name": "sample-project",
  "path": "sample-project.yyp",
},
```

```jsonc
// For assets in folders
// (The "name" is the folder name)
// (The "path" is to a non-existent file and the root is always "folders";
//  dropping ^folders and .yy$ yields the visible path in the tree )
// (Exactly matches name/path in an entry in the .yyp file)
"parent": {
  "name": "level3",
  "path": "folders/sample_resources/level2/level3.yy",
},
```

#### Tags

In GMS2.3 resources, folders, etc can have tags. These are used for filtering
content in the resource tree. They are always present as a "tags" field with a
simple list of strings.

#### Colors

**Colors are not saved.** You can color-code assets, but these are only stored
at the IDE level.

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

### Resources

Resources are found in `resourceType/resource_name` folders, always with a file
called `resourceType/resource_name/resource_name.yy`. These are JSON files whose contents
vary by asset type, but that have the common fields:

```jsonc
{
  "name": "resource_name",
  "resourceType": "GMShader",
  "tags": [],
  // Location in the visible heirarchy (not on disk)
  "parent": {
    "name": "sample_resources",
    "path": "folders/sample_resources.yy",
  },
  "resourceVersion": "1.0" // constant
}
```

Each asset type may include additional files and folders besides the `.yy` file.
Naming conventions for these other files varies by resource type.


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
