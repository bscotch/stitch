import { Gms2Project } from '../../lib/Gms2Project';
import { ImportBaseOptions, normalizeOptions } from './import-base-options';

export default function(options: ImportBaseOptions){
  options = normalizeOptions(options);
  const targetProject = new Gms2Project(options.targetProjectPath);
  targetProject.addSounds(options.sourcePath, options.allowExtensions);
}