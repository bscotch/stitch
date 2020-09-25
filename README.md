

<img  src="https://img.bscotch.net/fit-in/256x256/logos/stitch.png"
      style="max-width:100%;height:auto;"
      alt="Stitch (Gamemaker Studio 2 Pipeline Development Kit) Logo">
<h1>
  Stitch: The Gamemaker Studio 2 Pipeline Development Kit
</h1>


Gamemaker Studio 2 (<abbr title="Gamemaker Studio 2">GMS2</abbr>) is a powerful game-making tool, but it does not generally have features for automating tasks or creating asset pipelines. <dfn>Stitch</dfn> is a "Pipeline Development Kit" providing a collection of command-line tools and a Node.js API for automating tasks in GMS2 by directly managing its project files.

Stitch is developed by [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch").

<strong>⚠ WARNING ⚠ Use at your own risk.</strong> Stitch could completely break your Gamemaker project. If you do not completely trust your version control system, you should not use Stitch. To help keep you safe, Stitch will not run unless your project is in a git repo with a clean working directory, but that only helps if you know how to use git to recover in case something goes wrong.

### Table of Contents

+ [Compatibility Issues](#compatibility)
+ [Setup](#setup)
+ [Commandline Interface](#cli)
+ [Core Features](#features)
  + [Configuration File](#config-file) - Manage the behavior of Stitch.
  + [Modules](#modules) - Import groups of assets from other GMS2 projects.
    + [Module Notes](#modules-notes)
  + [Importing external assets](#import-asset)  - Import audio and other assets into a project.
    + [Import notes](#import-asset-notes)
  + [Texture Page batch management](#texture-pages) - Automate texture page assignments 
  + [Audio Group batch management](#audio-groups)
+ [Gamemaker Project File Structure](#gms2-file-structure)

## Gamemaker Studio Compatibility Issues

This project will generally stay up to date with current, stable versions of Gamemaker Studio 2. We will not typically test new versions of Stitch against older versions of Gamemaker Studio, and will also make no effort to maintain backwards compatibility. We'll list any known compatibility issues here.

+ **GMS2 versions < 2.3.0.529** are guaranteed **not to work** with any version of Stitch. Gamemaker completely changed its project structure in 2.3.0.529, and all prior project structures are completely incompatible with Stitch.

## Setup <a id="setup">

### Requirements

+ [Node.js v14+](https://nodejs.org/)
+ [Git](https://git-scm.com/) (if your project is not in a git repo, or your working tree is not clean, <strong>Stitch will refuse to run</strong>)
+ [Gamemaker Studio 2.3+](https://www.yoyogames.com/gamemaker) projects
+ Windows 10 (other operating systems may work but are untested)

### Gamemaker Project Setup

<details>
<summary><b>Example file structure</b></summary>

```bash
project-root/ # folder containing all your project's stuff
project-root/.git # created by `git init` or `git clone`
project-root/package.json # (not required) created by `npm init`
project-root/project-name/ # e.g. the name of your game
project-root/project-name/project-name.yyp # main GMS2 project file (entrypoint)
project-root/project-name/stitch.config.json # Stitch configuration data (created by Stitch)
```

</details>

Yours doesn't have to look *exactly* like that, but the general relationships should. For example, there must be a `.git` folder somewhere, and your [`.yyp` file](#yyp) must either be in the same directory as that `.git` folder or in a subdirectory as shown above.

To start using Stitch with one of your GMS2 projects, do the following:

1. Open a terminal in your project's root (e.g. via Git Bash or PowerShell)
  + On Windows 10 with Git installed, you can open the folder in File Explorer, right-click somewhere, and then click "Git Bash here". Alternatively, open the terminal anywhere and `cd` to the root of your project.
1. Run `npm install -g @bscotch/gms2` for a *global* install of Stitch, allowing you to install it just once and use it for all projects. This causes the `gms2 ...` commands to become available in the terminal.
1. Run `gms2 --help` to see all the things you can do.

**⚠ ALERT ⚠** When run, Stitch will attempt to install a pre-commit git hook that will convert all .yy and .yyp files to plain JSON (using `gms2 jsonify`). This is likely what you want. If you already have a pre-commit hook, this one will not be installed. You can simply add the line `npx gms2 jsonify --path .` somewhere in your existing pre-commit hook to get the same result.

### Stitch Configuration File <a id="config-file"></a>

To keep things stable and automatable, Stitch uses a configuration file (`stitch.config.json`) to store things like Texture Page and Audio Group assignments. This file is stored alongside the [`.yyp` file](#yyp). You can edit it manually, but it's a better idea to use Stitch CLI commands (see the [Audio Groups](#audio-groups) and [Texture Pages](#texture-pages) sections for examples).

<details>
<summary><b>Config File contents</b></summary>

```jsonc
{
  "texturePageAssignments":{
    "folder":"texturePageName",
    "folder/subfolder": "anotherTexturePageName"
  },
  "audioGroupAssignments":{
    "folder":"audioGroupName",
    "folder/subfolder": "anotherAudioGroupName"
  }
}
```

</details>

## Using the CLI <a id="cli"></a>

<b style="color:red">⚠ NOT YET IMPLEMENTED ⚠</b>
  
+ ❌ import
  + ✅ modules --source_project=path --modules=m1,m2 --target_project=path
  + sounds --source-path=dir/file --extensions=mp3,wave
  + files --source-path=dir/file --extensions=txt
+ ❌ assign
  + texture-groups --folder=sprites/myGroupOfSprites --group-name=name
  + audio-groups --folder=sound/myGroupOfSounds --group-name=name
+ ❌ version --set=version --get=platform
+ ✅ jsonify --dir --filepath

## Core Features <a id="features"></a>

### Gamemaker Modules <a id="modules"></a>

Gamemaker Studio has mechanisms to import assets from one Gamemaker project into another, as well as an "extensions" system, but this can be unwieldy to manage. We use a custom solution for this that we simply call "Modules". A "module" is a collection of assets that have a common folder name in their path. For example, for a module called "TitleScreen" and an asset hierarchy including:

+ `sprites/TitleScreen/{module content}`
+ `sounds/menus/TitleScreen/{module content}`
+ `TitleScreen/`

Everything inside those three "groups", starting at the "TitleScreen" level and including any subfolders, is included as a "TitleScreen" asset and can be imported together into another Gamemaker 2 project.

Use case: At Bscotch, we have a separate Gamemaker project for our shared asset library that includes our login system, a large script library, common objects, and more. We use the module system to import this shared library into all of our games, and to keep it up to date in all games.

#### Module Import Notes <a id="modules-notes"></a>

+ **All data is overwritten** in the target for module assets. Any changes you've made that aren't also in the source module will be lost forever. The exception to this is Texture and Audio Group membership when you use Stitch's system to manage those.
+ Only **resources** (e.g. sprites, objects, scripts, etc -- the things in the IDE's resource tree) and **IncludedFiles** are importable.
+ Module assets in the target that are *not* in the source are moved to a folder called "MODULE_CONFLICTS".
+ Failed imports may result in broken projects. Failures result from conflicts between the source and target, in particular when a resource in each has the same name but different type, or is in a different module.

### External Asset Importers <a id="import-asset"></a>

Managing art, audio, and file assets can be quite painful. These things should always be part of some sort of pipeline, but GMS2 does not provide built-in pipeline tooling. Stitch provides mechanisms to import external content into GMS2 projects, so that you can build pipelines appropriate to your technology stack.

For example, if your audio team dumps their files into a shared Dropbox folder, you can use the CLI to batch-import from that folder. This will update all existing sound assets and add any new ones, using the filenames as Gamemaker assets names. No manual steps required!

Or, if you have a content server storing images, sounds, or files, you can write a script to automatically import all up-to-date versions of those assets into your project.

At Bscotch, we use importers for our sound, art, and localization pipelines, so that our game programmers do not need to manually find, import, or name assets created by other team members.

#### Asset Import Notes <a id="import-asset-notes"></a>

+ Local texture page assignments are *not* overwritten when updating sprites. If the local sprite does not exist, or does exist but is assigned to a non-existent texture page, the source's texture page will be created locally and used by the imported sprite.

### Texture Page Management <a id="texture-pages"></a>

Texture page assignment of sprites via the GMS2 IDE is a fully manual process. Stitch allows you to map resource groups (the folders in the GMS2 IDE) to Texture Pages, so that all sprites within a specified group (recursing through subgroups) will be assigned to the same Texture Page. Groups with higher specificity take precedence.

For example, you might map the group `sprites/mainMenu/` to the texture page `mainMenuTexturePage`, so that *every* sprite inside the `sprites/mainMenu/` folder (recursive) will be put into the same texture page. You might then map the group `sprites/mainMenu/subMenu` to a different page `subMenuTexturePage`. In this case, all sprites within `sprites/mainMenu/` are first mapped to `mainMenuTexturePage`, and then all sprites within `sprites/mainMenu/subMenu` are remapped to `subMenuTexturePage` (since that group has one additional subfolder and is therefore more specific).

Texture Page assignments are stored in the [config file](#config-file) and can be modified via the CLI or by directly editing the configuration file.

**WARNING**: If there is a Texture Page assignment conflict between Stitch config file and what you do manually via the GMS2 IDE, the config file will win and the changes you made via the IDE will get overwritten the next time you run a `gms2` CLI command.


### Audio Group Management <a id="audio-groups"></a>

Audio Groups suffer the same manual problems as Texture Pages, and Stitch solves this in the same way.


## Game Project File Structure & Content <a id="gms2-file-structure"></a>

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

### YYP <a id="yyp"></a>

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

### Legend

+ ❌ something that is not yet completed
+ ✅ something that has been completed, in the context of other things that have not, to make it easier to track todos.
+ ⚠  something that the user should pay very close attention to in order to stay out of trouble