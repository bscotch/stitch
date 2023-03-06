import { pathy } from '@bscotch/pathy';

export const samplePath = pathy('samples');
export const projectFolders = (await samplePath.listChildren()).filter((x) => {
  return x.basename.match(/^\d+\.\d+\.\d+\.\d+$/);
});

export const projectVersions = projectFolders.map((x) => x.basename);
