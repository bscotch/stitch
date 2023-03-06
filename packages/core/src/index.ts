import { StitchProject } from './lib/StitchProject.js';
export * from './lib/StitchProject.js';
export * from './lib/StitchProjectConfig.js';
export type { FileDifferenceType } from './utility/files.js';
export { StitchProject as default } from './lib/StitchProject.js';

/**
 * Legacy alias for `StitchProject`.
 *
 * @deprecated
 */
export const Gms2Project = StitchProject;
