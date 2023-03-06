import { pathy } from '@bscotch/pathy';
import { SpriteImportOptions, StitchProject } from '../../lib/StitchProject.js';
import { info } from '../../utility/log.js';
import { ImportBaseOptions, normalizeOptions } from './add-base-options.js';

export default async function (
  options: ImportBaseOptions & SpriteImportOptions,
) {
  options = normalizeOptions(options);
  const targetProject = await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  info(`Importing updated sprites from source...`, {
    startTime: new Date(),
    source: pathy(options.source),
    target: pathy(targetProject.yypDirAbsolute),
  });
  await targetProject.addSprites(options.source, options);
  let doneMessage = `Completed importing updated sprites.`;
  if (options.watch) {
    doneMessage += ` Watching for changes...`;
  }
  info(doneMessage, {
    endTime: new Date(),
  });
}
