# Spritely: Image correction and cleanup for 2D video game sprites

In the [Gamemaker Studio video game engine](https://www.yoyogames.com/gamemaker)
(<abbr title="Gamemaker Studio">GMS</abbr>), and presumably other 2D game engines,
game "sprites" are a collection of
subimages (also called frames, referred to by index in GMS via `image_index`).

These subimages may represent frames of an animation, or collection of animations,
that the game can cycle through. Frames within a sprite can also be used to create
alternate versions of a static asset, such as recolors or random variants.

**📢 Announcement 📢** The deployed version of Spritely found [on npm](https://www.npmjs.com/package/@bscotch/spritely) is from an _internal_ fork of the [public repo](https://github.com/bscotch/spritely). The public repo will be archived. Non-Bscotch users should use the npm package for the most up-to-date version of Spritely.

**WARNING** This tool permanently changes your image files. Only use it if your
images are backed up somewhere. Take particular care when using recursive commands!

## About

Spritely aims to clean up subimages before you import them into your game
project, solving a few key problems:

- Edge interpolation artifacts (faint outlines around rendered sprites)
- Excessive padding (increases compiling time)
- Re-skinning via Gradient Maps

### Bleed: Remove edge interpolation artifacts

You may notice some border artifacts around your sprites, especially when the camera
is not positioned in a pixel-perfect way (e.g. in GMS when the
"Interpolate colors between pixels" is set). This is caused by the engine computing
a weighted average between the border pixel's color and the color of the
neighboring pixels on the texture page, which are transparent black or white
(`rgba(0,0,0,0)` or `rgba(255,255,255,0)`).
So if the edge of your sprite is yellow and you are rendering the sprite at
a subpixel position, you'll get a faint one-pixel-wide
border drawn around your image that is much darker or brighter than the original edge.

![Edge artifacts when tiling with subpixel camera positioning.](https://github.com/bscotch/spritely/raw/main/docs/figure-edge-artifact.png)

_A tile (inset) showing edge-alias artifacts when the camera moves
by subpixel (left) or full pixel (right). Artifacts are present in both
cases, but much more pronounced with subpixel camera positioning._

Spritely identifies the edge pixels and creates a border around them that is the
same color and mostly transparent, so that interpolation will not so dramatically
impact the edges of your images. This process goes by various names and may already
be available in your art creation tools. In Spine it's called "Bleed", in
other contexts you might see it as flood-filling or edge-padding.

Note that you shouldn't be able to tell the difference _by eye_ between
the original image and a bled image.

### Crop: Remove excessive padding

It's likely that your subimages consist of something meaningful drawn inside a
transparent rectangle. Excessive padding around the meaningful content adds more
pixels that Gamemaker must process when creating texture pages, so removing that
padding can dramatically speed up compiling.

Spritely crops your subimages to remove excess padding, but takes into account
all subimages in doing so to ensure that they are all cropped in the exact same
way. In effect, it creates a new bounding box based on the bounding boxes of
all subimages of a sprite.

![Figure with three panels described below.](https://github.com/bscotch/spritely/raw/main/docs/cropping.png)

The above figure demonstrates how Spritely crops sprites.
Panel <b>A</b> shows three subimages
of the same sprite, where the main content of each subimage takes up only a small
portion of the total subimage dimensions. Since the location of the content in
each subimage is different, cropping each subimage individually would result in
subimages of different sizes with inconsistent positioning relative to the original
sprite. Panel <b>B</b> shows how Spritely creates a bounding box taking the
content position of all subimages into account, with panel <b>C</b> showing the
cropped output.

### Gradient Maps (a.k.a. "Skins")

Clip Studio Paint, Photoshop, and other art creation software provide
a "Gradient Map" concept. The idea is to start with a grayscale art asset,
and then map positions along that grayscale spectrum onto colors, with
computed values in between those positions making up the 'gradient'.

Spritely can batch-apply any number of gradient maps to your sprites.
Sprite subimages are _assumed_ to be in grayscale, but any pixels that
are _not_ grayscale (i.e. the RGB values differ from one another) are
converted to grayscale before applying the gradient map.

(If you have an
image that has a combination of grayscale and non-grayscale pixels,
or are otherwise mapping from a non-grayscale image,
you may get unexpected results.)

Provide gradient maps with a YAML file describing each mapping and its
positional values. Positions are integers from 0-100, and colors are
hexadecimal strings.

```yml
# "Skins" are the gradient mappings. Each one ends up being a folder
# into which mapped images are placed. There is an implicit "default"
# skin that doesn't do anything.
skins:
  flux:
    0: "000000"
    100: "ffffff"
  spooky:
    0: "ff0000"
    0: "ff00ff"

# "Groups" are collections of images to which skins are applied.
# If no groups are provided, all skins are assumed to apply to all images.
# If *any* groups are provided, images will only be skinned if they match a group.
# Matching patterns are regex, and must be directly usable by JavaScript's `new RegExp()` method. They are tested against the image filename (not the parent folder/sprite).
# Case is always ignored. An image could land in multiple groups, and in that case
# will be skinned with the skins from all matching groups. Groups have no impact on
# output location or filename. Images that land in no groups are copied into the "none"
# skin folder, without being changed.
groups:
  - pattern: "^faceplate_" # Matches all image names starting with `faceplate_`
    match: 'subimage' # Checks pattern against subimage name by default. Can be set to "sprite" to test at sprite level.
    skins:
      - "flux"
      - "spooky"
  - pattern: "^(?!eyes_)" # Matches anything that *doesn't* start with `eyes_` (using negative lookahead)
    skins:
      - "spooky"
```

If Spritely finds a file named `skins.yml` or `gradmaps.yml`
(or one of a few similar variants) inside a sprite folder,
it will assume that it is a collection of gradient maps with format
given above, and those will be available for creating recolored images
of that sprite.

Alternatively, you can explicitly specify that Spritely use a different file of
Gradient Maps.

## Installation

- Requires [Node.js 14+](https://nodejs.org/en/).
- Only tested on Windows 10.

In a terminal, run `npm install --global @bscotch/spritely`

## Usage

### Organizing your files

In order to correct your sprite subimages, they must be organized
into one folder per sprite, each containing the subimages making
up that sprite as immediate PNG children.

By default, it is assumed that all subimages of a sprite should have
identical dimensions, and errors will be thrown if that isn't true.
You can bypass this assumption via the CLI or programmatic use of
Spritely.

For example, you might have a sprite called `enemy` with three
subimages to create a run cycle. You would save these like this:

```sh
enemy/ # Folder representing the sprite
enemy/enemy-idle.png
enemy/enemy-run.png
enemy/enemy-sit.png
```

#### Suffixes for overriding CLI commands

You'll likely be using the CLI to run batch operations on your images.
It's also likely that you'll want most of your images to be treated
one way, while some subset are treated another. This can get annoying,
since you'll have to run separate CLI commands, and put images in separate
folders, to make that happen.

Alternatively, you can add suffixes to your source image names to
ovverride whatever the CLI is doing. This allows you to put all images
in one place, use one CLI command to handle the most common case,
and then simply add a suffix to the names of those sprites you want
to have different treatments.

Suffixes are:

- `--c` or `--crop`: force cropping
- `--nc` or `--no-crop`: block cropping
- `--b` or `--bleed`: force bleeding
- `--nb` or `--no-bleed`: block bleeding

For example, if you had a sprite (folder) named `mySprite--c--nb`
(force crop, block bleed),
and then ran the CLI command `spritely bleed . . .` (see below),
the end result would be an image that was cropped but not bled.

In other words, suffix methods will _always_ be performed or
blocked whenever _any_ CLI command is run.

Note that sprites (folders) will be renamed to remove the
suffixes, so make sure that won't create naming conflicts.

### Running commands (CLI)

Run spritely commands by opening up a terminal
(such as Powershell, cmd, Git Bash, bash, etc), typing in
`spritely COMMAND ...`, and hitting ENTER.

To find all the commands and options, run `spritely -h`. To get
more information about a specific command, run `spritely THE-COMMAND -h`.

For example, `spritely crop` will run the `crop` command, while
`spritely crop -h` will show you the help information for the `crop` command.

_Note that the <dfn>Current Working Directory</dfn> generally refers to
the folder in which you opened your terminal open._

#### Examples

With the following file organization:

```sh
enemy/ # Folder representing the sprite
enemy/enemy-idle.png
enemy/enemy-run.png
enemy/leg/ # A subfolder representing another sprite related to 'enemy'
enemy/leg/leg-stand.png
enemy/leg/leg-walk.png
```

You could do the following (remember that **your files will be permanently changed** --
make sure you have backups!):

- `spritely crop --folder enemy` will crop `enemy/enemy-idle.png` and `enemy/enemy-run.png`
- `spritely crop -f enemy` is shorthand for the same thing
- `spritely crop --recursive -f enemy` will find all nested folders, treating each as a sprite, so that `enemy/leg/leg-stand.png` and `enemy/leg/leg-walk.png` will also be cropped. **Use with caution!**
- `spritely crop -r -f enemy` is shorthand for the same thing
- `spritely crop -f "C:\User\Me\Desktop\enemy"` provides an _absolute_ path if you are not currently in the parent folder of the `enemy` folder.
- `spritely bleed -f enemy` outlines the important parts of `enemy/enemy-idle.png` and `enemy/enemy-run.png` with nearly-transparent pixels to improve interpolation for subpixel camera positioning.
- `spritely fix -f enemy` crops and bleeds the `enemy` sprite.
- `spritely fix -f enemy --move somewhere/else` moves the sprite to `somewhere/else` after
  it has been processed. Also works recursively, with path provided to `--move` being used
  as the root directory. Note that old subimages in the target directory **are deleted** prior
  to moving the new ones, to ensure that the target directory has only the expected images.
  This feature is useful for pipelines where the presence/absence of images
  is used as an indicator for progress through the pipeline, or for export tools that
  refuse to overwrite existing images.
- `spritely fix -f enemy --move somewhere/else --purge-top-level-folders` will delete
  top-level folders (immediate children of `--folder`) prior to moving changed images.
  This is useful for ensuring that any sprites deleted from the source also don't appear
  downstream.
- `spritely fix -f enemy --root-images-are-sprites` causes any images directly in the root
  folder (`enemy`) to be treated as individual sprites, by putting each into their own
  folder. When used in combination with the `--recursive` flag, _only_ the root-level images
  are treated this way (all others are treated as normal). This is useful for cases where
  sprites containing only one image are not exported by your drawing software into a folder,
  but only as a single image.
- `spritely fix -r -f folder/with/all/your/sprites/ --if-match pattern` recursively
  looks at all the sprites in the `folder/with/all/your/sprites/` and performs the
  tasks _only if_ the pattern you provided with `--if-match` matches the top-level
  directory. Patterns are case-sensitive and are converted to regex with
  the JavaScript `new RegExp()`
  constructor. If you don't know what that means, don't worry, it'll still behave
  the way you expect most of the time. For example, with pattern `hello` you'd match
  `folder/with/all/your/sprites/helloworld` and `folder/with/all/your/sprites/ohhello`,
  but would not match `folder/with/all/your/sprites/different_top_level/hello`.
- `spritely skin -r -f sprites/to/recolor --gradient-maps-file my-map.yml`
  applies the gradient maps found in `my-map.yml` to every sprite found in `sprites/to/recolor`
  (recursively). Because application of gradient maps causes new sprites to be
  created, this CLI command has fewer options than the others and should be used
  with care.

### Programmatic Usage

If you want to add Spritely functionality to a Node.js project,
you can import it into a Node/Typescript module.

The classes and methods are all documented via Typescript
and JSDocs, so you'll be able to figure out your options
using the autocomplete features of Typescript/JSDoc-aware
code editors like Visual Studio Code.

#### Spritely Instances

```ts
import { Spritely } from '@bscotch/spritely';
// or, for node/Javascript
const { Spritely } = require('@bscotch/spritely');

async function myPipeline() {
  const sprite = new Spritely('path/to/your/sprite/folder');

  // use async/await syntax
  await sprite.crop();
  await sprite.bleed();
  await sprite.applyGradientMaps();

  // or use .then() syntax
  sprite.crop().then((cropped) => cropped.bleed());
}
```

#### SpritelyBatch Instances

Pipelines likely require discovering many sprites instead of
only pointing at one specific sprite. Spritely includes a
`SpritelyBatch` class for discovering sprite folders and creating
a collection of Spritely instances from them.

```ts
import { SpritelyBatch } from '@bscotch/spritely';

const batch = new SpritelyBatch('path/to/your/sprite/storage/root');
// Get a shallow copy of the list of created Spritely instances
const sprites = batch.sprites;
```
