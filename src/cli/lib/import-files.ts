import { Gms2Project } from '../../lib/Gms2Project';
import { ImportBaseOptions, normalizeOptions } from './import-base-options';

export default function(options: ImportBaseOptions){
  options = normalizeOptions(options);
  console.log(options);
  const targetProject = new Gms2Project(options.target_project_path);
  targetProject.addIncludedFiles(options.source_path, null, undefined, options.allow_extensions);
}