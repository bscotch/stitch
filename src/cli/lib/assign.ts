import cli_assert from './cli-assert';
import { Gms2Project } from '../../lib/Gms2Project';

export type AssignCliOptions = {
  folder: string;
  groupName: string;
  targetProject?: string;
  force?: boolean;
};

function normalizeAssignOptions(options: AssignCliOptions) {
  if (options.targetProject) {
    cli_assert.assertPathExists(options.targetProject);
  } else {
    options.targetProject = process.cwd();
  }
  return options;
}

export function assignTextureGroups(options: AssignCliOptions) {
  options = normalizeAssignOptions(options);
  const targetProject = new Gms2Project({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  targetProject.addTextureGroupAssignment(options.folder, options.groupName);
}

export function assignAudioGroups(options: AssignCliOptions) {
  options = normalizeAssignOptions(options);
  const targetProject = new Gms2Project({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  targetProject.addAudioGroupAssignment(options.folder, options.groupName);
}
