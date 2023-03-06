import { StitchProject } from '../../lib/StitchProject.js';
import cli_assert from './cli-assert.js';

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

export async function assignTextureGroups(options: AssignCliOptions) {
  options = normalizeAssignOptions(options);
  const targetProject = await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  await targetProject.addTextureGroupAssignment(
    options.folder,
    options.groupName,
  );
}

export async function assignAudioGroups(options: AssignCliOptions) {
  options = normalizeAssignOptions(options);
  const targetProject = await StitchProject.load({
    projectPath: options.targetProject,
    dangerouslyAllowDirtyWorkingDir: options.force,
  });
  await targetProject.addAudioGroupAssignment(
    options.folder,
    options.groupName,
  );
}
