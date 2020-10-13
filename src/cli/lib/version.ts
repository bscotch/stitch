import cli_assert from './cli-assert';
import { Gms2Project } from '../../lib/Gms2Project';

export type VersionOptions = {
  projectVersion: string,
  targetProjectPath?: string,
  force?: boolean,
};

export default function(options: VersionOptions){
  cli_assert.assert(options.projectVersion, "Must provide a valid version.");
  if (options.targetProjectPath){
    cli_assert.assertPathExists(options.targetProjectPath);
  }
  else{
    options.targetProjectPath = process.cwd();
  }
  const targetProject = new Gms2Project({
    projectPath: options.targetProjectPath,
    dangerouslyAllowDirtyWorkingDir: options.force
  });
  targetProject.version = options.projectVersion;
}