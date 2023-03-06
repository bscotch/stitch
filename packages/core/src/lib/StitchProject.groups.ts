import { Gms2Sound } from './components/resources/Gms2Sound.js';
import { Gms2Sprite } from './components/resources/Gms2Sprite.js';
import type { StitchProject } from './StitchProject.js';

/** Add a texture group assignment if it doesn't already exist. */
export async function addTextureGroupAssignment(
  project: StitchProject,
  folder: string,
  textureGroupName: string,
) {
  await project.config.addTextureGroupAssignment(folder, textureGroupName);
  await setTextureGroupsUsingConfig(project);
  return project;
}

/**
 * Ensure that the texture groups used in the config all exist, and
 * that sprites are properly assigned to them. (This must generally be re-run
 * on configuration upate, since cannot handle inheritance with singleton updates.)
 */
async function setTextureGroupsUsingConfig(project: StitchProject) {
  for (const textureGroupName of await project.config.getTextureGroupsWithAssignedFolders()) {
    project.addTextureGroup(textureGroupName);
  }
  // Ensure sprites are assigned to correct config texture groups.
  // This can be done by iterating backwards over the assignments,
  // since they get sorted by specificity (lowest first) and we only
  // want the most specific ones (those that match LAST unless reverse-sorted).
  const folders = (
    await project.config.getFoldersWithAssignedTextureGroups()
  ).reverse();
  const alreadyAssigned: Set<Gms2Sprite> = new Set();
  const textureGroupAssignments =
    await project.config.getTextureGroupAssignments();
  for (const folder of folders) {
    project.resources
      .filterByClassAndFolder(Gms2Sprite, folder)
      .forEach((sprite) => {
        if (alreadyAssigned.has(sprite)) {
          // Then should already have been assigned with the highest specificity possible.
          return;
        }
        sprite.textureGroup = textureGroupAssignments[folder];
        alreadyAssigned.add(sprite);
      });
  }
  return project;
}

/** Add a texture group assignment if it doesn't already exist. */
export async function addAudioGroupAssignment(
  project: StitchProject,
  folder: string,
  audioGroupName: string,
) {
  await project.config.addAudioGroupAssignment(folder, audioGroupName);
  await setAudioGroupsUsingConfig(project);
  return project;
}

/**
 * Ensure that the Sound assets have their Audio Groups correctly
 * assigned based on the config file. (This must generally be re-run
 * on configuration upate, since cannot handle inheritance with singleton updates.)
 */
async function setAudioGroupsUsingConfig(project: StitchProject) {
  for (const audioGroupName of await project.config.getAudioGroupsWithAssignedFolders()) {
    project.addAudioGroup(audioGroupName);
  }
  // Ensure sounds are assigned to correct config audio groups
  // This can be done by iterating backwards over the assignments,
  // since they get sorted by specificity (lowest first) and we only
  // want the most specific ones (those that match LAST unless reverse-sorted).
  const folders = (
    await project.config.getFoldersWithAssignedAudioGroups()
  ).reverse();
  const alreadyAssigned: Set<Gms2Sound> = new Set();
  const audioGroupAssignments = await project.config.getAudioGroupAssignments();
  for (const folder of folders) {
    project.resources
      .filterByClassAndFolder(Gms2Sound, folder)
      .forEach((sound) => {
        if (alreadyAssigned.has(sound)) {
          return;
        }
        sound.audioGroup = audioGroupAssignments[folder];
        alreadyAssigned.add(sound);
      });
  }
  return project;
}

export async function ensureResourceGroupAssignments(project: StitchProject) {
  return await setAudioGroupsUsingConfig(
    await setTextureGroupsUsingConfig(project),
  );
}
