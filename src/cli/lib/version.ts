import cli_assert from './cli-assert';
import { Gms2Project } from '../../lib/Gms2Project';

export type VersionOptions = {
  projectVersion: string;
  targetProject?: string;
  force?: boolean;
};

export default function (options: VersionOptions) {
  cli_assert.assert(options.projectVersion, 'Must provide a valid version.');
  if (options.targetProject) {
    cli_assert.assertPathExists(options.targetProject);
  } else {
    options.targetProject = process.cwd();
  }
  const targetProject = new Gms2Project({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  targetProject.version = options.projectVersion;
}
