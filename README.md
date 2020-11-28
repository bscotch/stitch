![Stitch (GameMaker Studio 2 Pipeline Development Kit) Logo](https://img.bscotch.net/fit-in/256x256/logos/stitch.png)

# Stitch: The GameMaker Studio 2 Pipeline Development Kit

GameMaker Studio 2 (<abbr title="GameMaker Studio 2">GMS2</abbr>) is a powerful game-making tool, but it does not generally have features for automating development or build tasks, or for creating asset pipelines. <dfn>Stitch</dfn> is a Pipeline Development Kit providing a collection of command-line tools and a Node.JS API for automating GMS2 project management by directly manipulating its project files.

Stitch is developed by [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch").

*GameMaker Studio 2&reg; is the property of Yoyo Games&trade;. Butterscotch Shenanigans and Stitch are not affiliated with Yoyo Games.*

**⚠WARNING⚠ Use at your own risk.** Stitch could completely break your GameMaker project. To help keep you safe, Stitch will not run unless your project is in a git repo with a clean working directory, but you must also know how to use git to recover in case something goes wrong.

## GameMaker Studio Compatibility

This project will generally stay up to date with the most recent versions of GameMaker Studio 2. We typically use beta or even alpha versions of GMS2. We will not typically test new versions of Stitch against older versions of GameMaker Studio, and will make no effort to maintain backwards compatibility. We'll list any known compatibility issues here, and we welcome GitHub Issues for any compatibility problems you discover.

+ **GMS2 versions < 2.3.0.529** **will not work at all** with any version of Stitch.

## Setup <a id="setup">

### Requirements

+ [Node.JS v14+](https://nodejs.org/)
+ [Git](https://git-scm.com/) (if your project is not in a git repo, or your working tree is not clean, <strong>Stitch will refuse to run</strong> unless you use the "force" options (which you shouldn't do))
+ [GameMaker Studio 2.3+](https://www.yoyogames.com/gamemaker) projects
+ Windows 10 (other operating systems may work but are untested)

### Installation

Install/update globally with `npm install -g @bscotch/stitch@latest`. This will let you use the CLI commands anywhere on your system. To install a specific version of Stitch, replace `@latest` with `@x.y.z`, where `x.y.x` is the specific version.

**ⓘ Note:** Updates to Stitch are likely to introduce new features and change existing features, so update with caution and [check the changelog](./CHANGELOG.md) first.

If you are creating a pipeline in Node.JS, you may want to install locally (same as above, but without the `-g`) and import directly into your code. Using Stitch programmatically will look something like this:

```ts
// @file Some component of your Typescript pipeline
import {Gms2Project} from "@bscotch/stitch";

const projectPath = 'my/project';
// Open a project. If you don't specify the path,
// it will search for a .yyp file starting in the current working directory
const myProject = new Gms2Project('my/project');

// Manipulate the project (toy example showing a few available methods)
myProject
  .importModules('other/project',['my_module'])
  .addTextureGroupAssignment('Sprites/interface','interface')
  .addSounds('my/sounds/source')
  .addSprites('my/art/assets',{prefix:'sp_',case:'snake'})
  .addIncludedFiles('my/localization/files');
```

**ⓘ Note:** The documentation is currently only within the code itself,
but will be surfaced for you with Typescript-aware IDEs
(such as Visual Studio Code). The examples here and below are all in
Typescript, but you can use plain Node.JS instead. The main difference
there will be in how you import Stitch: instead of
`import {Gms2Project} from "@bscotch/stitch"` you'd probably use
`const {Gms2Project} = require('@bscotch/stitch')`.


### Preparing your GameMaker project for Stitch

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

Yours doesn't have to look *exactly* like the example, but the general relationships should. For example, there must be a `.git` folder somewhere (created when you run `git init` or `git clone`), and your [`.yyp` file](docs/gms2-file-structure.md#yyp) must either be in the same directory as that `.git` folder or in a subdirectory as shown above.

To start using Stitch with one of your GMS2 projects, do the following:

1. Open a terminal in your project's root (e.g. via Git Bash or PowerShell)
  + On Windows 10 with Git installed, you can open the folder in File Explorer, right-click somewhere, and then click "Git Bash here". Alternatively, open the terminal anywhere and `cd` to the root of your project.
1. Run `npm install -g @bscotch/gms2` for a *global* install of Stitch, allowing you to install it just once and use it for all projects. This causes the `gms2 ...` commands to become available in the terminal.
1. Run `gms2 --help` to see all the things you can do.

### Stitch Configuration File <a id="config-file"></a>

To keep things stable and automatable, Stitch uses a configuration file (`stitch.config.json`) to store things like Texture Page and Audio Group assignments. This file is stored alongside the [`.yyp` file](docs/gms2-file-structure.md#yyp). You can edit it manually, but it's a better idea to use Stitch CLI commands (see the [Audio Groups](#audio-groups) and [Texture Pages](#texture-pages) sections for examples).

<details>
<summary><b>Config file example</b></summary>

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

## Using the Command Line Interface <a id="cli"></a>

If you've installed Stitch globally, the Command Line Interface (CLI) is available as `stitch` in your terminal. If you've installed it locally and your terminal is in the same location, you can run it with `npx stitch`. (Global install is recommended for ease of use.)

Up to date CLI documentation is available with the `--help` or `-h` flags of CLI commands. For example, run `stitch -h` to see all commands, `stitch merge -h` to see the merge subcommands/options, and so on.

This README includes example CLI calls in the relevant sections, but should not be treated as the full CLI documentation.


## Features <a id="features"></a>

### Project Merging <a id="modules"></a>

Importing assets from one GMS2 project into another is a painful process, especially
when you want to re-import updated assets.
Stitch includes a merger that allows you to bring a subset of
resources and included files from one GameMaker project into another.

Project Merging use cases:

+ Creating a private library of code shared across multiple games.
+ Creating a public library of utility assets for other developers.

Since GameMaker does not have name-spacing, merging projects can be a complicated
and dangerous process. The Stitch merger provides many options so that
you can carefully control merge behavior, and will output warnings and errors
when things go awry.

Stitch can use the following as source projects for merging:

+ Another local project (on your machine)
+ A GitHub repo.
+ A URL hosting a zipped GMS project.

Note that source projects must be from Stitch-compatible versions of GameMaker.


```sh
# CLI
stitch merge -h # Get help about importing modules

# Import specific modules:
stitch merge --source=path/to/your/modules-project --modules=my_module,my_other_module

# Import everything:
stitch merge --source=path/to/your/modules-project

# Import from GitHub
stitch merge --source-github=gm-core/gdash@6.0.2 --modules=util
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
// Import specific modules:
myProject.importModules('path/to/your/modules-project',['my_module','my_other_module']);
// Import everything:
myProject.importModules('path/to/your/modules-project');
```

#### Avoiding name conflicts

**Imports are dangerous** because GameMaker Studio has no concept of name-spacing. This makes it
easy to overwrite a resource that just happens to have the same name but is something different.
The default Stitch merge options err on the side of throwing errors when something looks like a conflict,
but there is no way to guarantee that you'll only replace things you intend to replace.

If you are writing code that you want to be able to merge into other projects,
or want to be able to merge code from other projects,
follow these best practices to minimize the chances of a conflict:

+ Minimize the number of global identifiers (scripts, global functions, global variables, and all assets).
  Everything that can be globally referenced carries a risk of having a name conflict.
+ To help with the prior goal, use structs to bundle functions and variables together.
  The struct then acts like a namespace. Unfortunately GameMaker does not have good
  Intellisense for function inside of structs, so this might do more harm than good
  (you can use the alternative, unofficial editor [GMEdit](https://yellowafterlife.itch.io/gmedit)
  to get better Intellisense).
+ Name your global entities in a way that will make them very likely to be unique.
  Prefixing all global entities with a short module identifier
  creates a simple namespacing mechanism,
  and will also group them together in Intellisense hints and search results.

#### Module Import Notes <a id="modules-notes"></a>

+ **All data is overwritten** in the target for module assets. Any changes you've made that aren't also in the source module will be lost forever. The exception to this is Texture and Audio Group membership when you use Stitch's system to manage those.
+ Only **resources** (e.g. sprites, objects, scripts, etc. -- the things in the IDE's resource tree) and **Included Files** are importable as modules.
+ Module assets in the target that are *not* in the source are moved to a folder called "MODULE_CONFLICTS". This prevents data loss. This behavior can be changed with the `doNotMoveConflicting` programmatic option or the `--do-not-move-conflicting` CLI flag.
+ GameMaker Studio does not have a concept of *namespacing*, so it is easy to end up with conflicting asset names between the source and target. By default an error is thrown in this case (leading to an incomplete merge) so that you can manually resolve the conflict. You can can this behavior using the `onClobber` programmatic option or the `--on-clobber` CLI option, setting the value to `overwrite` (to keep the source version) or `skip` (to keep the target version).
+ Failed imports may result in broken projects. Failures result from conflicts between the source and target, in particular when a resource in each has the same name but different type, or is in a different module.

### Create Assets <a id="import-asset"></a>

Managing art, audio, and file assets can be quite painful. GMS2 does not provide any batch-import or other pipeline tooling for converting external assets (like images, sounds, and other files) into GameMaker assets. Stitch provides such mechanisms, so that you can build pipelines appropriate to your technology stack.

For example, if your audio team dumps their files into a shared Dropbox folder, you can use the CLI to batch-import from that folder. This will update all existing sound assets and add any new ones, using the filenames as GameMaker asset names. No manual work required!

Same deal with sprites. Point the importer at a folder full of images to have them all automatically brought in as new or updated Sprites.

At Bscotch, we use pipelines for our sound, art, build, and localization pipelines, so that our game programmers do not need to manually find, import, or name assets created by other team members, and so that we can modify scripts and other assets prior to creating builds.

#### Create Sprites From Images

You can convert collections of images into GameMaker Sprites by first organizing
them into per-sprite folders, such that each folder contains a collection of images
that all have the exact same dimensions and that when sorted alphabetically are
in the order you want them in-game. You can then point Stitch at the root folder
containing all those sprite folders to automatically update/create in-game sprite
assets for each folder. During import, you can specify several options to map the
original art file names onto standardized sprite names.

```sh
# CLI
stitch add sprites -h # Get help about importing sprites
stitch add sprites --source=path/to/your/sprites
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
myProject.addSprites('path/to/your/sprites');
```

We have another tool, [Spritely](https://github.com/bscotch/spritely), that you
can use to batch-crop and batch-bleed your images prior to importing them into
GameMaker as sprites.

⚠WARNING⚠ Many changes you make to sprites imported via Stitch will be overwritten
the next time you run Stitch on those same sprites. In particular, changes to frames
or frame order will be undone, and any layers you've added will be deleted. Other
sprite properties (those not in the frame editor) will be maintained between imports.


#### Create Audio Files From Sound Files

You can batch-add audio files into GameMaker as sound assets.

```sh
# CLI
stitch add sounds -h # Get help about importing audio
stitch add sounds --source=path/to/your/sounds
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
myProject.addSounds('path/to/your/sounds');
```

#### Create "Included Files"

You can batch-add external files into your GameMaker project
as Included Files. This is useful for managing things like
localization data, or data that you want to add or remove
prior to making production builds. During import you can
put files into subfolders, and you can even create files on
the fly when using Stitch programmatically.

```sh
# CLI
stitch add files -h # Get help about importing audio
# Add all txt and json files found in a folder (recursively)
stitch add files --source=path/to/your/files --extensions=txt,json
# Add a specific file
stitch add files --source=path/to/your/file.txt
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
// Add all txt and json files found in a folder (recursively)
myProject.addIncludedFiles('path/to/your/files',{extensions:['txt','json']});
// Add a specific file
myProject.addIncludedFiles('path/to/your/file.txt');
// Create an included file on the fly
myProject.addIncludedFiles('path/to/your/new-file.txt',{content:'Here is the file content.'});
```

#### Create/Update Scripts

You can create and update scripts programmatically:

```ts
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
myProject.addScript('your/script/name','// Just a placeholder now!');
myProject.resources.findByName('name').code = 'function functionName(arg1){return arg1;}'
```

#### Create Objects

You can create Objects programmatically:

```ts
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
myProject.addObject('your/object/name');
```

### Texture Group Management <a id="texture-pages"></a>

Texture group assignment of sprites via the GMS2 IDE is a fully manual, per-sprite process. Stitch allows you to map folders (in the GMS2 IDE resource tree) to Texture Groups, so that all sprites within a specified folder (recursing through subfolders) will be assigned to the same Texture Page. Folders with *higher specificity* take precedence.

For example, you might map the group `sprites/mainMenu/` to the texture page `mainMenuTexturePage`, so that *every* sprite inside the `sprites/mainMenu/` folder (recursive) will be put into the same texture page. You might then map the group `sprites/mainMenu/subMenu` to a different page `subMenuTexturePage`. In this case, all sprites within `sprites/mainMenu/` are first mapped to `mainMenuTexturePage`, and then all sprites within `sprites/mainMenu/subMenu` are remapped to `subMenuTexturePage` (since that group has one additional subfolder and is therefore more specific).

Texture Page assignments are stored in the [config file](#config-file) and can be modified via the CLI or by directly editing the configuration file.

**ⓘ NOTE:** If you've added sprites to a folder via the IDE (instead of via the Stitch sprite importer),
you'll need to run a Stitch command to ensure those sprites have their assignments changed.

```sh
# CLI
stitch set texture-group -h # Get help assigning texture groups
stitch set texture-group --folder=folder/in/the/ide --group-name=nameOfYourTextureGroup
# Run the 'deborker' to ensure all assignments are correct
# after making manual changes via the IDE.
stitch debork
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
// Create a new Texture Group (without assigning anything to it)
myProject.addTextureGroup('nameOfYourTextureGroup');
// Assign a texture group to all sprites within an folder
// (the Texture Group will be created if it doesn't already exist)
myProject.addTextureGroupAssignment('folder/in/the/ide','nameOfYourTextureGroup');
```



### Audio Group Management <a id="audio-groups"></a>

Audio Group management is solved the [same way that Texture Groups are managed](#texture-pages).

```sh
# CLI
stitch set audio-group -h # Get help assigning audio groups
stitch set audio-group --folder=folder/in/the/ide --group-name=nameOfYourAudioGroup
# Run the 'deborker' to ensure all assignments are correct,
# especially after making manual changes in the IDE.
stitch debork
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
// Create a new Audio Group (without assigning anything to it)
myProject.addAudioGroup('nameOfYourAudioGroup');
// Assign a audio group to all sounds within an folder
// (the Audio Group will be created if it doesn't already exist)
myProject.addAudioGroupAssignment('folder/in/the/ide','nameOfYourAudioGroup');
```

### Programmatically Modifying Your Project and Assets

Stitch grants access to the guts of GMS2 project assets, allowing you write
scripts and pipelines that automate asset management in all kinds of ways.
For example, you may want to replace a script with different content,
set all sounds to have a different bitrate, and more.

Some modification methods have available batch functions at the `Gms2Project`
instance level, while others are available on instances representing
specific resources. The best way to find all available options is to
use a Typescript-aware IDE to view the documentation while creating a
project, but some samples are below:

```ts
import {Gms2Project} from "@bscotch/stitch";

// Load a project by searching starting in the current working directory
const myProject = new Gms2Project();
// Set the version in all options files
myProject.version = "1.0.0";
myProject.deleteResourceByName('myCrappySprite');
myProject.deleteIncludedFileByName('secrets.txt');
myProject.addConfig('develop');
// Create new folders in the asset tree shown in the IDE
myProject.addFolder('my/new/folder');

// Manipulating existing resources my require first finding them.

// For 
const anObject = myProject.resources.findByName('myObject');
// -or-
const anObject = myProject.resources.objects.find(object=>object.name=='myObject');

// Change the object's sprite
anObject.spriteName = 'aDifferentSprite';

// Change the bitRate of all sounds
myProject.resources.sounds.forEach(sound=>{
  sounds.bitRate = 64;
})
```

**ⓘ Note:** We (Bscotch) add features only when we need them, so existing functionality
will always be limited. However, the code is set up to make it relatively
easy for someone familiar with Typescript to be able to add features: if
you want to add new features, see [how you can contribute](CONTRIBUTING.md).

