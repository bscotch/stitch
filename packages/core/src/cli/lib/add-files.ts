import { StitchProject } from '../../lib/StitchProject.js';
import { ImportBaseOptions, normalizeOptions } from './add-base-options.js';

export default async function (options: ImportBaseOptions) {
  options = normalizeOptions(options);
  const targetProject = await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  targetProject.addIncludedFiles(options.source, {
    allowedExtensions: options.extensions,
  });
}
