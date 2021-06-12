
<p align="center"><i><a href="https://www.bscotch.net">Butterscotch Shenanigans</a> Presents:</i></p>


<p align="center">
  <img src="https://img.bscotch.net/fit-in/256x256/logos/stitch.png" alt="Stitch (GameMaker Studio 2 Pipeline Development Kit) Logo"/>
</p>

<h1 align="center"> Stitch: The GameMaker Studio 2 Pipeline Development Kit</h1>

<dfn>Stitch</dfn> is a powerful Pipeline Development Kit for GameMaker Studio 2 (<abbr title="GameMaker Studio 2">GMS2</abbr>).

+ 🤖 Batch-add and update sprites (from PNG images and Spine exports)
+ 🔊 Batch-add and update sounds
+ 🔃 Safely import (and re-import) any assets from one project into another (even directly from GitHub!)
+ 💻 Use the Command Line Interface (CLI) for instant pipelines
+ 📁 Batch-manage audio and texture groups based on folder structure
+ ⌨ Programmatically generate and modify resources with the Stitch Node.js API
+ 🐛 Identify code issues through static code analysis

Stitch is developed by [Butterscotch Shenanigans](https://www.bscotch.net) ("Bscotch").


**⚠WARNING⚠ Use at your own risk.** Stitch could completely break your GameMaker project. To help keep you safe, Stitch will not run unless your project is in a git repo with a clean working directory, but you must also know how to use git to recover in case something goes wrong.

*GameMaker Studio 2&reg; is the property of Yoyo Games&trade;. Butterscotch Shenanigans&reg; and Stitch are not affiliated with Yoyo Games.*

## 🚀 Quick Start

+ Install [Node.JS v14+](https://nodejs.org/)
+ Ensure your GMS2 project is in a Git repo.

### 💻 CLI:

+ In the terminal, navigate to the root folder of your GameMaker project
+ Globally install Stitch: `npm install --global @bscotch/stitch`
+ Find the CLI command you want: `stitch --help`
+ Learn about that command's options: `stitch the-command-you-chose --help`

### ⌨ Programmatic:

+ In the terminal, navigate to your Node.js project
+ Locally install Stitch: `npm install @bscotch/stitch`
+ In your code, import the `Gms2Project` class from Stitch
  + ESM style: `import {Gms2Project} from "@bscotch/stitch"`
  + CommonJS style: `const {Gms2Project} = require('@bscotch/stitch')`
+ In your code, load a GameMaker project by creating a `Gms2Project` instance: `const myProject = new Gms2Project('my/project/folder');`
+ Use the Intellisense features of your editor (e.g. Visual Studio Code) to explore the API of the class instance.

## Table of Contents

+ [Compatibility](#compatibility)
+ [Setup](#setup)
  + [Requirements](#requirements)
  + [Installation](#install)
  + [Project Setup](#game-setup)
  + [Stitch Config File](#config-file)
+ [Ways to Use Stitch](#usage)
  + [Using the Command Line](#cli) (typical use-case)
  + [In Node.js apps](#usage-programming) (for custom pipelines)
+ [Things to do with Stitch](#features)
  + [Merge GMS2 Projects](#merging) (treat GMS2 projects as modules)
  + [Automatically Create and Update Assets](#import-asset)
    + [Sprites (including Spine)](#import-sprites)
    + [Sounds](#import-sounds)
    + [Included Files](#import-files)
    + [Objects](#import-objects)
    + [Scripts](#import-scripts)
  + [Manage Texture Groups](#texture-groups)
  + [Manage Audio Groups](#audio-groups)
  + [Identify Code Issues](#linter)

## GameMaker Studio Compatibility <a id="compatibility"></a>

This project will generally stay up to date with the bleeding-edge versions of GameMaker Studio 2. We typically use beta or even alpha versions of GMS2. We will not test new versions of Stitch against older versions of GameMaker Studio, and will make no effort to maintain backwards compatibility. We'll list any known compatibility issues here, and we welcome GitHub Issues for any compatibility problems you discover.

+ **GMS2 versions < 2.3.0.529** **will not work at all** with any version of Stitch.

## Setup <a id="setup">

### Requirements <a id="requirements"></a>

+ [Node.JS v14+](https://nodejs.org/)
+ [Git](https://git-scm.com/) (if your project is not in a git repo, or your working tree is not clean, <strong>Stitch will refuse to run</strong> unless you use the "force" options (which you shouldn't do))
+ [GameMaker Studio 2.3+](https://www.yoyogames.com/gamemaker) projects
+ Windows 10 (other operating systems may work but are untested)

### Installation <a id="install"></a>

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


### Preparing your GameMaker project for Stitch <a id="game-setup"></a>

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
1. Run `npm install -g @bscotch/stitch` for a *global* install of Stitch, allowing you to install it just once and use it for all projects. This causes the `stitch ...` commands to become available in the terminal.
1. Run `stitch --help` to see all the things you can do.

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

## Usage <a id="usage"></a>

### Command Line Interface (CLI) <a id="cli"></a>

If you've installed Stitch globally, the Command Line Interface (CLI) is available as `stitch` in your terminal. If you've installed it locally and your terminal is in the same location, you can run it with `npx stitch`. (Global install is recommended for ease of use.)

Up-to-date CLI documentation is available with the `--help` or `-h` flags of CLI commands. For example, run `stitch -h` to see all commands, `stitch merge -h` to see the merge subcommands/options, and so on.

This README includes example CLI calls for each feature in the [Features section](#features).

### Scripting/Custom Pipelines in Node.js <a id="usage-programming"></a>

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

This README includes additional code examples for each feature in the [Features section](#features).

**ⓘ Note:** We (Bscotch) add features only when we need them, so existing functionality
will always be limited. However, the code is set up to make it relatively
easy for someone familiar with Typescript to be able to add features: if
you want to add new features, see [how you can contribute](CONTRIBUTING.md).


## Features <a id="features"></a>

### Merging Projects <a id="merging"></a>

Importing assets from one GMS2 project into another is a painful process, especially
when you want to re-import.
Stitch includes a merger that lets you import a subset of
resources and included files from one GameMaker project into another.
This allows you to share and re-use code, while making it easy
to keep that code up to date.

**⚠WARNING⚠** Merging GameMaker projects could permanently break your
project. Only bypass the source control requirement if you are completely
okay with having a ruined project!

Since GameMaker does not have name-spacing, merging projects can be a complicated
and dangerous process. The Stitch merger provides many options so that
you can carefully control merge behavior, and will output warnings and errors
when things go awry. Carefully check your options when merging to make sure
you're getting what you want and, where possible, only merge projects that
are using [good naming practices](#best-practice-naming) to reduce the chances of conflicts and confusion.

Stitch can use the following as source projects for merging:

+ Another local project (on your machine)
+ A GitHub repo.
+ A URL hosting a zipped GMS project.

Note that source projects must be from Stitch-compatible versions of GameMaker.

If you want to use a *private* GitHub repo as a source, you'll need
to create a
[Personal Access Token](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token)
for your GitHub account and then make it available to Stitch via the environment
variable `GITHUB_PERSONAL_ACCESS_TOKEN`. You can do this by creating a file called
`.env` or `stitch.env`, in the same place from which you're running Stitch or
in your home folder, and adding the line `GITHUB_PERSONAL_ACCESS_TOKEN=your_access_token`.
Stitch will automatically check those locations for your token.


```sh
# CLI
stitch merge -h # Get up-to-date documentation on merging options

# Import everything
stitch merge --source=source/path

# Import all sprites in a folder matching "title"
# -or- if the sprite name matches regex ^sp_title_
stitch merge --source=source/path --if-name-matches=^sp_title_ --if-folder-matches=title --types=sprites\

# Merge from a GitHub repo (latest commit)
stitch merge --source-github=gm-core/gdash

# Import scripts from a project on GitHub (from the commit tagged "6.0.2")
stitch merge --source-github=gm-core/gdash@6.0.2 --types=scripts

# Merge from a GitHub repo (latest commit on the master branch)
stitch merge --source-github=gm-core/gdash@master

# Merge from a GitHub repo (that most recent commit with any tag)
stitch merge --source-github="gm-core/gdash?"

# Merge from a GitHub repo (that most recent commit with a semver tag)
stitch merge --source-github="gm-core/gdash?^v(\\d+\\.){2}\\d+$"
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
// Import everything:
myProject.merge('path/to/your/modules-project');
// Import with options specified:
myProject.merge('path/to/your/modules-project', {
  ifNameMatches: string['^hello'],
  types: ['objects'],
  skipDependencyCheck: true,
  moveConflicting: true,
  onClobber: 'error'
}
});
```

#### Avoid name conflicts <a id="best-practice-naming"></a>

**Imports are dangerous** because GameMaker Studio has no concept of name-spacing. This makes it
easy to overwrite a resource that just happens to have the same name but is something different.
The default Stitch merge options err on the side of throwing errors when something looks like a conflict,
but there is no way to guarantee that you'll only replace things you intend to replace.

If you are writing code that you want to be able to merge into other projects,
or want to be able to merge code from other projects,
follow these best practices to minimize the chances of a conflict:

+ Minimize the number of global identifiers (scripts, global functions, global variables, and all assets).
  Everything that can be globally referenced carries a risk of having a name conflict.
+ Use structs to bundle functions and variables together, creating a basic namespace.
  Unfortunately GameMaker does not have good
  Intellisense for functions inside of structs, so this might not ideal
  (you can use the alternative, unofficial editor [GMEdit](https://yellowafterlife.itch.io/gmedit)
  to get better Intellisense).
+ Name your global entities in a way that will make them very likely to be unique.
  Prefixing all global entities with a short project identifier
  creates a simple namespacing mechanism,
  and will also group related things together in Intellisense hints and search results.

### Create Assets <a id="import-asset"></a>

Managing art, audio, and file assets can be quite painful. GMS2 does not provide any batch-import or other pipeline tooling for converting external assets (like images, sounds, and other files) into GameMaker assets. Stitch provides such mechanisms, so that you can build pipelines appropriate to your technology stack.

For example, if your audio team dumps their files into a shared Dropbox folder, you can use the CLI to batch-import from that folder. This will update all existing sound assets and add any new ones, using the filenames as GameMaker asset names. No manual work required!

Same deal with sprites. Point the importer at a folder full of images to have them all automatically brought in as new or updated Sprites.

At Bscotch, we use pipelines for our sound, art, build, and localization pipelines, so that our game programmers do not need to manually find, import, or name assets created by other team members, and so that we can modify scripts and other assets prior to creating builds.

#### Create Sprites From Images and Spine exports <a id="import-sprites"></a>

You can convert collections of images and Spine exports
into GameMaker Sprites by first organizing
them into per-sprite folders.

For image-based sprites, each
folder must contain a collection of images
that all have the exact same dimensions and that when sorted alphabetically are
in the order you want them in-game.

For Spine-based sprites,
each folder must contain the exactly one PNG file, an atlas file,
and a JSON file.

Point Stitch at the root folder
containing all those sprite folders to automatically update/create in-game sprite
assets for each folder. During import, you can specify several options to map the
original art file names onto standardized sprite names. Stitch automatically
detects Spine-based sprites and handles them at the same time.

```sh
# CLI
stitch add sprites -h # Get help about importing sprites
stitch add sprites --source=path/to/your/sprites
```

```ts
// Typescript
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
const addSpriteOptions = {
  prefix: 'sp_',
  case: 'camel',
  /**
   * For example,
   * for `root/my/sprite/` the flattened name would
   * be `my_sprite` (if using snake case).
   */
  flatten: true,
  exclude: /_draft$/,
}
myProject.addSprites('path/to/your/sprites',addSpriteOptions);
```

We have another tool, [Spritely](https://github.com/bscotch/spritely), that you
can use to batch-crop and batch-bleed your images prior to importing them into
GameMaker as sprites.

**⚠WARNING⚠** Many changes you make to sprites imported via Stitch will be overwritten
the next time you run Stitch on those same sprites. In particular, changes to frames
or frame order will be undone, and any layers you've added will be deleted. Other
sprite properties (those not in the frame editor) will be maintained between imports.


#### Create Audio Files From Sound Files <a id="import-sounds"></a>

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

#### Create "Included Files" <a id="import-files"></a>

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

#### Create/Update Scripts <a id="#import-scripts">

You can create and update scripts programmatically:

```ts
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
myProject.addScript('your/script/name','// Just a placeholder now!');
myProject.resources.findByName('name').code = 'function functionName(arg1){return arg1;}'
```

#### Create Objects <a id="#import-objects">

You can create Objects programmatically:

```ts
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();
myProject.addObject('your/object/name');
```

### Texture Group Management <a id="texture-groups"></a>

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


### Linter <a id="linter"></a>

** ⚠ This is a new feature that is both incomplete and likely to change substanially! ⚠ **

The GMS2 IDE has limited Intellisense, does not do type-checking, and has a noisy syntax error log that does not allow easy differentiation of types of issues (nor ignoring things that are actually fine). Collectively this makes it difficult to have confidence that the code will run successfully, especially since code issues may not be discovered until run-time. Runtime errors are expensive to discover and fix, because they can easily slip through QA unnoticed and are likely to have hard-to-trace consequences.

Stitch provides limited linter capabilities to help with some of the short-comings of the build-in GMS2 error detection systems.


```sh
# Run via the commandline to get a linter report.
# Use flags and options to control what gets checked. 
stitch lint -h # See options
```

```ts
// Typescript: Using the linter and underlying functionality programmatically
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();

// Get linter output. Runs any available checks by default.
// An options object creates an allowlist of what gets checked instead.
const linterResults = myProject.lint();
```

#### Non-referenced Global Functions

Identify global functions (any function defined in a script using the standard named-function syntax)
that are not references in the project. This is useful for finding legacy functions that can be
removed.

** ⚠ Only the following are checked for references:**

+ Scripts
+ Object events

(Room code and any other GML sources are not currently checked.)


#### Global Function Versioning

Because GMS2 does not have strict typing for function signatures, when a function changes its signature there is no way to know if usage of that function follows the new signature. To combat this, we use a simple approach to API versioning, where we post-fix function names with `_v1` when its behavior has changed (incrementing the version number with each breaking change). This essentially breaks existing uses of that function because they are using a name that no longer exists, making it easy to create a list of function references that have not been updated to reflect the changes to the function signature.

The GMS2 IDE does list these cases among the syntax errors, but there is no way to specifically identify these cases amongst the others. Therefore there is no way to be certain that all references to the old function have been updated.

Stitch includes functionality to identify these cases, so that one can retrieve and exhaustive list of these issues and then check again after refactoring to ensure that that list has become empty.

** ⚠ Only the following are checked for references:**

+ Scripts
+ Object events

(Room code and any other GML sources are not currently checked.)

```ts
// Typescript: Using the linter and underlying functionality programmatically
import {Gms2Project} from "@bscotch/stitch";
const myProject = new Gms2Project();

// Find all function references, returned as complex objects
// for further parsing and analysis. In this case, fuzzy matching
// will be used to find references that match a function name even
// if they have a different "version suffix"
// (e.g. `myFunc_v1` would show as a reference to function `myFunc` or `myFunc_v10`,
// but the field `isCorrectVersion` would be `false` in the returned reference objects.)
const nonreferencedFunctions = myProject
  .findGlobalFunctionReferences({versionSuffix:'(_v\\d+)?'})
  .filter(r=>!r.references.length);

// Alternatively, use the linter method
const linterResults = myProject.lint({versionSuffix:'(_v\\d+)?'})
```
