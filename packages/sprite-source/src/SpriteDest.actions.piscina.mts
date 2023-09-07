import { pathy, type Pathy } from '@bscotch/pathy';
import { yySpriteSchema, type YypResourceId, type YySprite } from '@bscotch/yy';
import fsp from 'fs/promises';
import path from 'path';
import type { SpriteDestAction } from './SpriteDest.schemas.js';

export interface ApplySpriteActionOptions {
  projectYypPath: string;
  action: SpriteDestAction;
}

export interface SpriteDestActionResult {
  resource: YypResourceId;
  folder: { name: string; folderPath: string };
}

/** @internal */
export default async function applySpriteActionParallel({
  projectYypPath,
  action,
}: ApplySpriteActionOptions): Promise<SpriteDestActionResult> {
  // Ensure the target path exists
  const targetFolder = pathy(action.dest);
  // If this is a `create` action, delete the existing sprite
  // (no effect when there literally is no existing sprite, but
  // there could be leftover files, or a sprite with the same name
  // but different type, etc.)
  if (action.kind === 'create') {
    await targetFolder.delete({
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 50,
    });
  }
  await targetFolder.ensureDirectory();

  // Get the list of children in the source and destination
  const [initialDestFileNames, sourceFileNames] = await Promise.all([
    fsp.readdir(targetFolder.absolute, { withFileTypes: true }),
    fsp.readdir(action.source, { withFileTypes: true }),
  ]);
  const initialDestFiles = initialDestFileNames
    .filter((f) => f.isFile())
    .map((f) => pathy(f.name, targetFolder));
  const sourceFiles = sourceFileNames
    .filter((f) => f.isFile())
    .map((f) => pathy(f.name, action.source));
  const sourcePngs = sourceFiles.filter((f) => f.basename.match(/\.png$/i));

  // Load the yy file, or populate a default one
  const yyFile: Pathy<YySprite> = (
    (initialDestFiles.find(
      (f) => f.basename.toLowerCase() === `${action.name}.yy`.toLowerCase(),
    ) as Pathy<YySprite> | undefined) ||
    pathy(`${action.name}.yy`, targetFolder)
  ).withValidator(yySpriteSchema);
  let yy = await yyFile.read({
    fallback: { name: action.name, type: action.spine ? 2 : 0 },
  });
  // Populate the frames to get UUIDs
  const frames = yy.frames || [];
  frames.length = action.spine ? 1 : sourcePngs.length;
  yy = yySpriteSchema.parse({ ...yy, frames });

  if (action.spine) {
    // Copy over and rename the skeleton files
    const uuid = yy.frames[0].name;
    const ioWaits: Promise<any>[] = [];
    const keepers = new Set([yyFile.basename.toLowerCase()]);
    for (const fileType of ['json', 'atlas', 'png']) {
      const sourceFile = pathy(`skeleton.${fileType}`, action.source);
      const destFile = pathy(
        `${fileType === 'png' ? 'skeleton' : uuid}.${fileType}`,
        targetFolder,
      );
      ioWaits.push(sourceFile.copy(destFile));
      keepers.add(destFile.basename.toLowerCase());
    }
    // Delete excess files
    for (const file of initialDestFiles) {
      if (!keepers.has(file.basename.toLowerCase())) {
        ioWaits.push(
          file.delete({
            force: true,
            maxRetries: 5,
            retryDelay: 50,
          }),
        );
      }
    }
    await Promise.all(ioWaits);
  } else {
    // Ensure the source pngs are sorted by basename
    sourcePngs.sort((a, b) => a.basename.localeCompare(b.basename, 'en-US'));

    // Copy over the pngs
    const ioWaits: Promise<any>[] = [];
    const keepers = new Set([yyFile.basename.toLowerCase()]);
    for (let i = 0; i < sourcePngs.length; i++) {
      const uuid = yy.frames[i].name;
      const png = sourcePngs[i];
      const destFile = pathy(`${uuid}.png`, targetFolder);
      ioWaits.push(png.copy(destFile));
      keepers.add(destFile.basename.toLowerCase());
    }
    // Delete excess files
    for (const file of initialDestFiles) {
      if (!keepers.has(file.basename.toLowerCase())) {
        ioWaits.push(
          file.delete({
            force: true,
            maxRetries: 5,
            retryDelay: 50,
          }),
        );
      }
    }
    await Promise.all(ioWaits);
  }

  // Save the yy file
  await yyFile.write(yy);

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
  };
}
