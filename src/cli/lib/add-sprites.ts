import { Gms2Project, SpriteImportOptions } from '../../lib/Gms2Project';
import { ImportBaseOptions, normalizeOptions } from './add-base-options';

export default function (options: ImportBaseOptions & SpriteImportOptions) {
  options = normalizeOptions(options);
  const targetProject = new Gms2Project({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  targetProject.addSprites(options.source, options);
}
