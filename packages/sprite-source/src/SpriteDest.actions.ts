import { pathy, type Pathy } from '@bscotch/pathy';
import { Yy, YySprite, yySpriteSchema, type YypResourceId } from '@bscotch/yy';
import path from 'path';
import { readdirSafeWithFileTypes } from './safeFs.js';
import type { SpriteDestAction } from './SpriteDest.schemas.js';
import { getPngSize } from './utility.js';

export interface ApplySpriteActionOptions {
  projectYypPath: string;
  action: SpriteDestAction;
}

export interface SpriteDestActionResult {
  resource: YypResourceId;
  folder: { name: string; folderPath: string };
  /** The path to the sprite source root from which this action started */
  sourceRoot: string;
}

export async function applySpriteAction({
  projectYypPath,
  action,
}: ApplySpriteActionOptions): Promise<SpriteDestActionResult> {
  let trace: any[] = [];
  try {
    // Ensure the target path exists
    const targetFolder = pathy(action.dest);
    // If this is a `create` action, delete the existing sprite
    // (no effect when there literally is no existing sprite, but
    // there could be leftover files, or a sprite with the same name
    // but different type, etc.)
    if (action.kind === 'create') {
      trace.push(`Recursively deleting ${targetFolder}`);
      await targetFolder.delete({
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      });
    }
    trace.push(`Ensuring ${targetFolder}`);
    await targetFolder.ensureDirectory();

    // Get the list of children in the source and destination
    trace.push(`Reading ${targetFolder.absolute} and ${action.source}`);
    const [initialDestFileNames, sourceFileNames] = await Promise.all([
      readdirSafeWithFileTypes(targetFolder),
      readdirSafeWithFileTypes(action.source),
    ]);
    const initialDestFiles = initialDestFileNames
      .filter((f) => f.isFile())
      .map((f) => pathy(f.name, targetFolder));
    const sourceFiles = sourceFileNames
      .filter((f) => f.isFile())
      .map((f) => pathy(f.name, action.source));
    const sourcePngs = sourceFiles.filter((f) => f.basename.match(/\.png$/i));

    // Get origin info etc
    trace.push(`Getting origin info`);
    const size = await getPngSize(sourcePngs[0]);
    const width = size.width;
    const height = size.height;
    const xorigin = Math.floor(width / 2) - 1;
    const yorigin = Math.floor(height / 2) - 1;

    // Load the yy file, or populate a default one
    const yyFile: Pathy =
      initialDestFiles.find(
        (f) => f.basename.toLowerCase() === `${action.name}.yy`.toLowerCase(),
      ) || pathy(`${action.name}.yy`, targetFolder);
    if (!(await yyFile.exists())) {
      trace.push(`Creating ${yyFile.absolute}`);
      await Yy.write(
        yyFile.absolute,
        {
          name: action.name,
          type: action.spine ? 2 : 0,
          width,
          height,
          sequence: { xorigin, yorigin },
        },
        'sprites',
      );
    }
    trace.push(`Reading yy file ${yyFile}`);
    let yy = await Yy.read(yyFile.absolute, 'sprites');

    // Populate the frames to get UUIDs
    // const frames = yy.frames || []; // Keep the old frameIds
    const frames: YySprite['frames'] = [];
    frames.length = action.spine ? 1 : sourcePngs.length;
    yy = yySpriteSchema.parse({ ...yy, frames });

    if (action.spine) {
      trace.push('Is Spine action');
      // Copy over and rename the skeleton files
      const uuid = yy.frames[0].name;
      const ioWaits: Promise<any>[] = [];
      const keepers = new Set([yyFile.basename.toLowerCase()]);
      for (const fileType of ['json', 'atlas', 'png']) {
        const sourceFile = sourceFiles.find((f) => f.hasExtension(fileType))!;
        const destFile = pathy(
          `${fileType === 'png' ? sourceFile.name : uuid}.${fileType}`,
          targetFolder,
        );
        trace.push(`Copying ${sourceFile} to ${destFile}`);
        ioWaits.push(
          sourceFile.copy(destFile).catch((reason) => {
            trace.push(reason);
            throw reason;
          }),
        );
        keepers.add(destFile.basename.toLowerCase());
        keepers.add(`${uuid}.${fileType}`.toLowerCase());
      }
      // Delete excess files
      for (const file of initialDestFiles) {
        if (!keepers.has(file.basename.toLowerCase())) {
          trace.push(`Deleting ${file}`);
          ioWaits.push(
            file
              .delete({
                force: true,
                maxRetries: 5,
                retryDelay: 50,
              })
              .catch((reason) => {
                trace.push(reason);
                throw reason;
              }),
          );
        }
      }
      trace.push('Awaiting io ops');
      await Promise.all(ioWaits);
    } else {
      trace.push('Is non-Spine action');
      // Ensure the source pngs are sorted by basename
      sourcePngs.sort((a, b) => a.basename.localeCompare(b.basename, 'en-US'));

      // Ensure the width & height are still correct
      yy.width = width;
      yy.height = height;

      // Copy over the pngs
      const ioWaits: Promise<any>[] = [];
      const keepers = new Set([yyFile.basename.toLowerCase()]);
      for (let i = 0; i < sourcePngs.length; i++) {
        const uuid = yy.frames[i].name;
        const png = sourcePngs[i];
        const destFile = pathy(`${uuid}.png`, targetFolder);
        trace.push(`Copying ${png} to ${destFile}`);
        ioWaits.push(
          png.copy(destFile).catch((reason) => {
            trace.push(reason);
            throw reason;
          }),
        );
        keepers.add(destFile.basename.toLowerCase());
      }
      // Delete excess files
      for (const file of initialDestFiles) {
        if (!keepers.has(file.basename.toLowerCase())) {
          trace.push(`Deleting ${file}`);
          ioWaits.push(
            file
              .delete({
                force: true,
                maxRetries: 5,
                retryDelay: 50,
              })
              .catch((reason) => {
                trace.push(reason);
                throw reason;
              }),
          );
        }
      }
      trace.push('Awaiting io ops');
      await Promise.all(ioWaits);
    }

    // Save the yy file
    trace.push(`Saving yy file ${yyFile}`);
    await Yy.write(yyFile.absolute, yy, 'sprites');

    // Send back info that can be used to update the project file
    return {
      resource: {
        name: yy.name,
        path: yyFile.relativeFrom(path.dirname(projectYypPath)),
      },
      folder: {
        name: yy.parent.name,
        folderPath: yy.parent.path,
      },
      sourceRoot: action.sourceRoot,
    };
  } catch (err) {
    trace.push(err);
    throw trace;
  }
}
