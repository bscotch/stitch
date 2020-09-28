import { Gms2Project } from '../../lib/Gms2Project';
import { ImportBaseOptions, normalizeOptions } from './import-base-options';

export default function(options: ImportBaseOptions){
  options = normalizeOptions(options);
  console.log(options);
  const targetProject = new Gms2Project(options.targetProjectPath);
  targetProject.addIncludedFiles(options.sourcePath, null, undefined, options.allowExtensions);
}