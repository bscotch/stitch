import { Gms2Project } from '../../lib/Gms2Project';
import cliAssert from './cli-assert';

export type ImportModuleOptions = {
  source_project_path: string,
  modules: string[],
  target_project_path ?: string
}

export default function(options: ImportModuleOptions){
  const {source_project_path, modules} = options;
  let {target_project_path} = options;
  cliAssert.assertPathExists(source_project_path);
  cliAssert.assertAtLeastOneTruthy(...modules);
  if(target_project_path){
    cliAssert.assertPathExists(target_project_path);
  }
  else{
    target_project_path = process.cwd();
  }

  const targetProject = new Gms2Project(target_project_path);
  targetProject.importModules(source_project_path,modules);
}
