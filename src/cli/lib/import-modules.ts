import { Gms2Project } from '../../lib/Gms2Project';
import fs from '../../lib/files';
import { assert } from '../../lib/errors';

export default function(source_project_path:string, modules:string[] | string, target_project_path?:string){
  assert(fs.existsSync(source_project_path), `Source project does not exists at: ${source_project_path}`);
  let targetModules: string[];
  if (!Array.isArray(modules)){
    targetModules = [modules] as string[];
  }
  else{
    targetModules = modules;
  }
  targetModules.forEach((module)=>{
    assert((typeof module) == "string", `Target modules are not entered as strings: ${module}`);
  });

  const targetProject = new Gms2Project(target_project_path || process.cwd());
  targetProject.importModules(source_project_path,targetModules);
  return targetProject;
}
