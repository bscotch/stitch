import { debounceWatch } from '@bscotch/debounce-watch';
import { oneline, RequiredBy } from '@bscotch/utility';
import type { Command } from 'commander';
import type { FSWatcher } from 'fs';
import path from 'path';
import { assert, ErrorCodes, SpritelyError } from '../lib/errors.js';
import { debug, error, info, warning } from '../lib/log.js';
import { Spritely } from '../lib/Spritely.js';
import { fsRetry as fs } from '../lib/utility.js';

export interface SpritelyCliGeneralOptions {
  folder: string;
  recursive?: boolean;
  allowSubimageSizeMismatch?: boolean;
  move?: string;
  rootImagesAreSprites?: boolean;
  enforceSyncedBatches?: boolean;
  ifMatch?: string;
  deleteSource?: boolean;
  gradientMapsFile?: string;
  watch?: boolean;
  debug?: boolean;
}

const methodOverrideTagNames = {
  c: 'crop',
  crop: 'crop',
  b: 'bleed',
  bleed: 'bleed',
} as const;

type SpritelyMethodOverrideTag = keyof typeof methodOverrideTagNames;
type SpritelyMethodOverrideName =
  typeof methodOverrideTagNames[SpritelyMethodOverrideTag];

type SpritelyFixMethod = 'crop' | 'bleed' | 'applyGradientMaps';

function crash(err?: SpritelyError | Error) {
  // If in debug mode, log the whole-assed error. Otherwise just the message.
  error('Crashed due to uncaught error');
  console.log(err);
  process.exit(1);
}

process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);

export const cliOptions = {
  folder: [
    '-f --folder <path>',
    oneline`
      Path to folder of subimages. Only
      immediate PNG children of each folder are treated as subimages.
      Defaults to the current working directory.`,
    process.cwd(),
  ],
  recursive: [
    '-r --recursive',
    oneline`
      Treat --folder, and all folders inside --folder (recursively), 
      as sprites.
      Each folder with immediate PNG children is treated as a sprite,
      with those children as its subimages. When using this mode, immediate
      child folders of --folder are treated as "batches", providing
      additional options (e.g. --enforce-synced-batches).`,
  ],
  watch: [
    '-w --watch',
    oneline`
      Watch the source path for the the appearance of, or changes to,
      PNG files. When those events occur, re-run the fixers.
    `,
  ],
  mismatch: [
    '-a --allow-subimage-size-mismatch',
    oneline`
      By default it is required that all subimages of a sprite are
      supposed to have identical dimensions. You can optionally bypass
      this requirement.`,
  ],
  move: [
    '-m --move <path>',
    oneline`
      Move images to a different folder after modification.
      Useful for pipelines that use presence/absence
      of images as signals. Maintains relative paths.
      Deletes any existing subimages before copying the new
      ones over.`,
  ],
  purge: [
    '--enforce-synced-batches',
    oneline`
      This treats top-level folders (immediate children of --folder)
      as "batches" when using the 'move' option. When fixing sprites
      inside of a batch, any sprites found in the move target but not
      in the source are deleted. This lets you treat your art source
      as the "truth", so that fixed assets available to a downstream
      game completely match what the artist is intending to be in
      the game (e.g. legacy sprites in a batch will be deleted from
      the move target).`,
  ],
  /** Specify root images are sprites */
  rootImages: [
    '-s --root-images-are-sprites',
    oneline`
      Prior to correction, move any immediate PNG children of
      --folder into folders with the same name as those images.
      This allows root-level images to be treated as individual
      sprites.`,
  ],
  match: [
    '-p --if-match <pattern>',
    oneline`
      Only perform the tasks on sprites whose top-level folder
      (relative to --folder) matches this pattern. Case-sensitive,
      converted to a regex pattern using JavaScript's 'new RegExp()'.`,
  ],
  debug: ['--debug', `Show verbose logging and error output.`],
} as const;

export function addGeneralOptions(cli: Command) {
  cli
    .option(...cliOptions.folder)
    .option(...cliOptions.recursive)
    .option(...cliOptions.watch)
    .option(...cliOptions.mismatch)
    .option(...cliOptions.move)
    .option(...cliOptions.purge)
    .option(...cliOptions.rootImages)
    .option(...cliOptions.match)
    .option(...cliOptions.debug);
  return cli;
}

async function getSpriteDirs(folder: string, recursive?: boolean) {
  if (!(await fs.pathExists(folder))) {
    return [];
  }
  const allFolders = [folder];
  if (recursive) {
    const children = await fs.listFolders(folder, recursive);
    allFolders.push(...children);
  }
  allFolders.reverse();
  // Restrict to folders that have at least one child PNG file.
  const spriteFolders: string[] = [];
  for (const possibleSpriteFolder of allFolders) {
    const childPngs = await fs.listFilesByExtension(
      possibleSpriteFolder,
      'png',
      false,
    );
    if (childPngs.length) {
      spriteFolders.push(possibleSpriteFolder);
    }
  }
  return spriteFolders;
}

function getMovedSpritePath(
  options: { move: string; folder: string },
  spriteDir: string,
) {
  return path.join(options.move, path.relative(options.folder, spriteDir));
}

/**
 * The sprite name may include suffixes to indicate overrides
 * for any CLI-applied adjustments. These can force application
 * of methods as well as prevent them. Suffixes being with `--`
 * and are chained together without separators. Valid suffices:
 * + `--c` or `--crop`: force cropping
 * + `--nc` or `--no-crop`: block cropping
 * + `--b` or `--bleed`: force bleeding
 * + `--nb` or `--no-bleed`: block bleeding
 */
function getMethodOverridesFromName(name: string) {
  // Pull off all the method suffixes
  const overrides = {
    name,
    add: [] as SpritelyMethodOverrideName[],
    remove: [] as SpritelyMethodOverrideName[],
  };
  let bareName = name; // suffixes removed
  const suffixRegex = /^(.*)(--(n?[cb]|(no-)?(crop|bleed)))$/;
  while (bareName.match(suffixRegex)) {
    const parts = bareName.match(suffixRegex);
    if (!parts) {
      break;
    }
    bareName = parts[1];
    const overrideType = parts[2].match(/^--n/) ? 'remove' : 'add';
    const methodNickname = parts[2].replace(
      /--(no-|n)?/,
      '',
    ) as SpritelyMethodOverrideTag;
    const method = methodOverrideTagNames[methodNickname];
    assert(method, `${methodNickname} is not a valid method suffix.`);
    debug(`Method override ${method} found for ${name}`);
    overrides[overrideType].push(method);
  }
  overrides.name = bareName;
  return overrides;
}

async function fixSpriteDir(
  method: SpritelyFixMethod | SpritelyFixMethod[],
  spriteDir: string,
  options: SpritelyCliGeneralOptions,
) {
  try {
    const spriteOptions = {
      spriteDirectory: spriteDir,
      allowSubimageSizeMismatch: options.allowSubimageSizeMismatch,
      gradientMapsFile: options.gradientMapsFile,
    };
    // Reduce logger clutter by *not* logging "fixes" that result in no changes.
    let sprite = new Spritely(spriteOptions);
    const methodOverrides = getMethodOverridesFromName(sprite.name);
    // Combine methods provided by the CLI and by the name suffixes,
    // and then filter out those blocked by name suffixes.
    const methods = [
      ...new Set(
        (typeof method == 'string' ? [method] : method)
          .concat(methodOverrides.add)
          .filter(
            (method) =>
              !methodOverrides.remove.includes(
                method as SpritelyMethodOverrideName,
              ),
          ),
      ),
    ];
    // Sort so that cropping happens before bleeding, making bleeding less costly.
    methods.sort().reverse();
    debug(`Will apply ${methods} to ${sprite.name}`);

    // If the sprite uses suffixes, should nuke that folder and replace
    // it with one that doesn't have the suffixes.
    if (sprite.name != methodOverrides.name) {
      const spriteParent = path.dirname(sprite.path);
      const newSpritePath = path.join(spriteParent, methodOverrides.name);
      await fs.remove(newSpritePath); // make sure the dest gets clobbered
      await sprite.copy(spriteParent, { name: methodOverrides.name });
      await fs.remove(sprite.path);
      spriteDir = newSpritePath;
      debug(`Computed real name ${methodOverrides.name} from ${sprite.name}`);
      sprite = new Spritely({ ...spriteOptions, spriteDirectory: spriteDir });
    }

    let originalSubimageChecksums = await sprite.checksums;

    for (const spriteMethod of methods) {
      if (spriteMethod == 'applyGradientMaps') {
        await sprite.applyGradientMaps(options.deleteSource);
      } else if (spriteMethod == 'bleed') {
        await sprite.bleed();
      } else if (spriteMethod == 'crop') {
        await sprite.crop(methods.includes('bleed') ? 1 : 0);
      } else {
        throw new SpritelyError(`Invalid correction method ${spriteMethod}`);
      }
    }

    const fixedSubimageChecksums = await sprite.checksums;

    if (options.move) {
      debug('Moving modified sprite', sprite.name, 'to', options.folder);
      originalSubimageChecksums = [];
      const movedSpritePath = getMovedSpritePath(
        options as RequiredBy<SpritelyCliGeneralOptions, 'move'>,
        spriteDir,
      );
      if (await fs.pathExists(movedSpritePath)) {
        // Clear any excess files!
        const newNames = sprite.paths.map((p) => path.parse(p).base);
        const existingSubimages = await fs.listFilesByExtension(
          movedSpritePath,
          'png',
        );
        originalSubimageChecksums = await Promise.all(
          existingSubimages.map((i) => Spritely.pixelsChecksum(i)),
        );
        const waits = existingSubimages.map((existingSubimage) => {
          // Remove IF this subimage is extraneous to the
          // newer source.
          const existingName = path.parse(existingSubimage).base;
          if (!newNames.includes(existingName)) {
            debug('Removing excess subimage in move target', existingSubimage);
            return fs.remove(existingSubimage);
          }
          return Promise.resolve();
        });
        (await Promise.allSettled(waits)).forEach((wait, i) => {
          if (wait.status == 'rejected') {
            debug(`Remove attempt rejected`, existingSubimages[i]);
          }
        });
      }
      await sprite.move(path.dirname(movedSpritePath));
    }
    // If the resulting images are contained within the originals,
    // log via debug instead of info to reduce clutter.
    const nothingChanged = fixedSubimageChecksums.every((fixedChecksum) =>
      originalSubimageChecksums.includes(fixedChecksum),
    );
    (nothingChanged ? debug : info)(
      `Fixed ${sprite.name}:`,
      sprite.path.includes(' ') ? `"${sprite.path}"` : sprite.path,
      nothingChanged ? '(no changes)' : '',
    );
  } catch (err: any) {
    if (
      SpritelyError.matches(err, [
        ErrorCodes.noImagesFound,
        ErrorCodes.sizeMismatch,
      ])
    ) {
      warning(`Skipped sprite "${spriteDir}": ${err.message}`);
    } else {
      error(`Sprite clean failed for "${spriteDir}".`, err?.message);
      throw err;
    }
  }
}

async function fixSpriteDirs(
  method: SpritelyFixMethod | SpritelyFixMethod[],
  spriteDirs: string[],
  options: SpritelyCliGeneralOptions,
) {
  for (const spriteDir of spriteDirs) {
    await fixSpriteDir(method, spriteDir, options);
  }
}

/** The name of the parent directory of a relative path. */
function parentDirName(fullpath: string, relativeTo = '.') {
  return path.relative(relativeTo, fullpath).split(/[\\/]/g)[0];
}

async function fixSprites(
  method: SpritelyFixMethod | SpritelyFixMethod[],
  options: SpritelyCliGeneralOptions,
) {
  if (options.rootImagesAreSprites) {
    await changeRootImagesToSprites(options);
  }
  const spriteDirs = await findMatchingSpriteDirs(options);
  if (options.enforceSyncedBatches && options.move) {
    // Then we need to make sure that moving doesn't create
    // any problems, and that things stay synced
    // (extraneous files in the target are removed)
    await cleanBatchMoveTarget(spriteDirs, options);
  }
  await fixSpriteDirs(method, spriteDirs, options);
  if (options.move) {
    await fs.removeEmptyDirs(options.folder, { excludeRoot: true });
  }
}

/**
 * When ensuring that a sprite batch is synced with its move-to
 * location, extraneous sprites in the downstream
 * batch location must be removed.
 */
async function cleanBatchMoveTarget(
  spriteDirs: string[],
  options: SpritelyCliGeneralOptions,
) {
  const batches = getSpriteDirsByBatch(spriteDirs, options);
  for (const batchName of batches.names) {
    const moveDir = path.join(options.move!, batchName);
    const exists = await fs.pathExists(moveDir);
    if (!exists) {
      // No possible conflicts
      debug(
        `Skipping batch-syncing for ${batchName}: target folder does not exist`,
      );
      return;
    }
    // See what sprites are already here and delete
    // those that aren't also in the source.
    const spriteDirsInMoveFolder = await findMatchingSpriteDirs({
      ...options,
      folder: moveDir,
    });
    const relativeSpriteDirsInMoveFolder = spriteDirsInMoveFolder.map((d) => {
      return path.relative(options.move!, d);
    });
    const extraneousSpriteDirsInMoveFolder =
      relativeSpriteDirsInMoveFolder.filter((d) => {
        return !batches.batches[batchName].includes(d);
      });
    for (const extraFolder of extraneousSpriteDirsInMoveFolder) {
      // Already know there are images in here, that's how we got the folder
      const extraFolderPath = path.join(options.move!, extraFolder);
      const extraChildren = await fs.listFilesByExtension(
        extraFolderPath,
        'png',
        false,
      );
      for (const extraChild of extraChildren) {
        debug(`Deleting "${extraChild}" to sync batch to source`);
        await fs.remove(extraChild);
      }
      // Attempt to clean up the folder in case there's nothing in it.
      await fs.removeEmptyDirs(extraFolderPath);
    }
  }
}

interface SpriteDirBatches {
  names: string[];
  /**
   * For each batch, the array of sprite dir paths,
   * *relative to* the root (therefore will be the same
   * in either source or move target)
   */
  batches: { [batchName: string]: string[] };
}

function getSpriteDirsByBatch(
  spriteDirs: string[],
  options: SpritelyCliGeneralOptions,
) {
  const batches: SpriteDirBatches = { names: [], batches: {} };
  for (const spriteDir of spriteDirs) {
    const batchName = parentDirName(spriteDir, options.folder);
    if (!batches.names.includes(batchName)) {
      batches.names.push(batchName);
      batches.batches[batchName] = [];
    }
    batches.batches[batchName].push(path.relative(options.folder, spriteDir));
  }
  return batches;
}

async function findMatchingSpriteDirs(options: SpritelyCliGeneralOptions) {
  const ifMatch = options.ifMatch ? new RegExp(options.ifMatch) : null;
  const allSpriteDirs = await getSpriteDirs(options.folder, options.recursive);
  return allSpriteDirs.filter((spriteDir) => {
    if (options.enforceSyncedBatches || ifMatch) {
      // Then limit to things that have a top-level folder
      const topLevelDir = parentDirName(spriteDir, options.folder);
      if (!topLevelDir) {
        debug(`Skipping ${spriteDir}: does not have top-level folder.`);
        return false;
      }
      const matchesFilter = !ifMatch || topLevelDir.match(ifMatch);
      if (!matchesFilter) {
        debug(`Skipping ${spriteDir}: does not match filter ${ifMatch}`);
      }
      return matchesFilter;
    }
    return true;
  });
}

async function changeRootImagesToSprites(options: SpritelyCliGeneralOptions) {
  // Find any root-level PNGs and move them into a folder by the same name
  const rootImages = await fs.listFilesByExtension(
    options.folder,
    'png',
    false,
  );
  for (const rootImage of rootImages) {
    const name = path.parse(rootImage).name;
    const newFolder = path.join(options.folder, name);
    const newPath = path.join(newFolder, `${name}.png`);
    await fs.ensureDir(newFolder);
    await fs.move(rootImage, newPath);
  }
}

/** Prepare and run sprite fixers, include setting up watchers if needed. */
export async function runFixer(
  method: SpritelyFixMethod | SpritelyFixMethod[],
  options: SpritelyCliGeneralOptions,
): Promise<FSWatcher | undefined> {
  if (options.debug) {
    process.env.DEBUG = 'true';
    debug('DEBUG mode');
  }
  assert(
    options.enforceSyncedBatches ? options.recursive : true,
    `'Batches' do not exist unless using recursive mode.`,
  );
  const run = () => fixSprites(method, options);
  if (options.watch) {
    return await debounceWatch(run, options.folder, {
      onlyFileExtensions: 'png',
      logger: { info, debug, warn: warning, error },
    });
  } else {
    await run();
  }
  return;
}
