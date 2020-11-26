import { Gms2ImportModulesOptions } from '../../lib/Gms2ModuleImporter';
import { Gms2Project } from '../../lib/Gms2Project';
import cli_assert from './cli-assert';

export interface ImportModuleOptions extends Gms2ImportModulesOptions {
  sourceProjectPath: string,
  modules?: string[],
  targetProjectPath ?: string,
  force?: boolean,
}

export default function(options: ImportModuleOptions){
  const {sourceProjectPath} = options;
  let {targetProjectPath} = options;
  cli_assert.assertPathExists(sourceProjectPath);
  if(targetProjectPath){
    cli_assert.assertPathExists(targetProjectPath);
  }
  else{
    targetProjectPath = process.cwd();
  }

  const targetProject = new Gms2Project({
    projectPath: options.targetProjectPath,
    dangerouslyAllowDirtyWorkingDir: options.force
  });
  targetProject.importModules(sourceProjectPath,options.modules,options);
}
