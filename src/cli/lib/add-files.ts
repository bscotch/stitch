import { Gms2Project } from '../../lib/Gms2Project';
import { ImportBaseOptions, normalizeOptions } from './add-base-options';

export default function(options: ImportBaseOptions){
  options = normalizeOptions(options);
  const targetProject = new Gms2Project({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force
  });
  targetProject.addIncludedFiles(options.source, {allowedExtensions: options.extensions});
}