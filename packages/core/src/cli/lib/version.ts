import { StitchProject } from '../../lib/StitchProject.js';
import cli_assert from './cli-assert.js';

export type VersionOptions = {
  projectVersion: string;
  targetProject?: string;
  force?: boolean;
};

export default async function (options: VersionOptions) {
  cli_assert.assert(options.projectVersion, 'Must provide a valid version.');
  if (options.targetProject) {
    cli_assert.assertPathExists(options.targetProject);
  } else {
    options.targetProject = process.cwd();
  }
  const targetProject = await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  targetProject.version = options.projectVersion;
}
