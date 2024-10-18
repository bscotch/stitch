import { StitchProject } from '../../index.js';
import { StitchCliTargetParams } from './params.types.js';

export * from './params.global.js';
export * from './params.merge.js';
export * from './params.types.js';

export async function loadProjectFromArgs<T extends StitchCliTargetParams>(
  options: T,
) {
  return await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
    readOnly: options.readOnly,
  });
}
