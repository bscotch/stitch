import { Gms2Project } from '../../lib/Gms2Project';
import cli_assert from './cli-assert';

export type ImportModuleOptions = {
  sourceProjectPath: string,
  modules: string[],
  targetProjectPath ?: string,
  force?: boolean,
}

export default function(options: ImportModuleOptions){
  const {sourceProjectPath, modules} = options;
  let {targetProjectPath} = options;
  cli_assert.assertPathExists(sourceProjectPath);
  cli_assert.assertAtLeastOneTruthy(modules);
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
  targetProject.importModules(sourceProjectPath,cli_assert.getTruthyArgs(modules));
}
