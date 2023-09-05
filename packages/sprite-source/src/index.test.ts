import { pathy, type Pathy } from '@bscotch/pathy';
import { SpriteSource } from './SpriteSource.js';

const samples = pathy('samples');
const sampleProject = samples.join('project');
const sampleSpine = samples.join('spine');
const sampleSprite = samples.join('sprite');

const sandbox = pathy('sandbox');
const sandboxProject = sandbox.join('project');
const sandboxStaging = sandbox.join('staging');

type StagingOrg = {
  path: string;
  spine?: boolean;
  expect?: {
    cropped?: boolean;
    bled?: boolean;
    ignored?: boolean;
    renamed?: string;
  };
}[];

const sandboxStagingOrg = [
  {
    path: 'spine',
    spine: true,
  },
  {
    path: 'sprite',
    spine: false,
    expect: {
      cropped: true,
      bled: true,
    },
  },
  {
    path: 'subfolder/subsubfolder/spine2',
    spine: true,
    expect: {
      renamed: 'renamedSpine2',
    },
  },
  {
    path: 'subfolder/subsubfolder/sprite2',
    expect: {
      cropped: true,
      bled: true,
    },
  },
  {
    path: 'subfolder/suffixes/sprite3--impl',
    expect: {
      cropped: true,
      bled: true,
    },
  },
  {
    path: 'subfolder/suffixes/sprite4--nc',
    expect: {
      cropped: false,
      bled: true,
    },
  },
  {
    path: 'subfolder/suffixes/sprite5--nb',
    expect: {
      cropped: true,
      bled: false,
    },
  },
  {
    path: 'subfolder/suffixes/sprite6--nb--nc',
    expect: {
      cropped: false,
      bled: false,
    },
  },
  {
    path: 'subfolder/suffixes/sprite7--ignore',
    expect: {
      ignored: true,
    },
  },
] satisfies StagingOrg;

async function deleteFolder(folder: Pathy) {
  return await folder.delete({
    force: true,
    recursive: true,
    maxRetries: 6,
    retryDelay: 20,
  });
}

async function initializeStaging() {
  await deleteFolder(sandboxStaging);
  await sandboxStaging.ensureDirectory();
  // Make a bunch of copies of sprites and spines
  // in the staging folder.
  for (const org of sandboxStagingOrg) {
    const source = org.spine ? sampleSpine : sampleSprite;
    const target = sandboxStaging.join(org.path);
    await source.copy(target);
  }
}

async function initializeSandbox() {
  await deleteFolder(sandbox);
  await sandbox.ensureDirectory();
  await sampleProject.copy(sandboxProject);
  await initializeStaging();
}

describe('Sprite Sources', function () {
  it('can import from a sprite source', async function () {
    await initializeSandbox();
    const source = new SpriteSource(sandboxStaging);
    await source.import(sandboxProject, {});
  });
});
