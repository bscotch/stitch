import type { ProjectSummary } from '@bscotch/stitch-server/client';
import { serverBaseUrl } from './info.js';

/**
 * Get the *smallest* icon larger than `minWidth`
 * (in pixels) from a project.
 */
export function getProjectIcon(project: ProjectSummary, minWidth: number) {
  const icon =
    project.icons.find((icon) => icon.width >= minWidth) ||
    project.icons.at(-1);
  if (!icon) {
    return;
  }
  return {
    ...icon,
    url: `${serverBaseUrl}/projects/${project.id}/files/${icon.path}`,
  };
}
