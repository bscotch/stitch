import { StitchProject } from '../../lib/StitchProject.js';
import { ImportBaseOptions, normalizeOptions } from './add-base-options.js';

export default async function (options: ImportBaseOptions) {
  options = normalizeOptions(options);
  const targetProject = await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  await targetProject.addSounds(options.source, {
    extensions: options.extensions,
  });
}
