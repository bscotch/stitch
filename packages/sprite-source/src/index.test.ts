import { pathy, type Pathy } from '@bscotch/pathy';
import { SpriteSource } from './SpriteSource.js';
import { getDirs } from './utility.js';

const samples = pathy('samples');
const sampleProject = samples.join('project');
const sampleSpine = samples.join('spine');
const sampleSprite = samples.join('sprite');
const sampleInvalidSprite = samples.join('invalid-sprite');

const sandbox = pathy('sandbox');
const sandboxSource = sandbox.join('source');
const sandboxProject = sandbox.join('project');
const sandboxProjectYyp = sandboxProject.join('project.yyp');
const sandboxStaging = sandbox.join('staging');

type StagingOrg = {
  path: string;
  spine?: boolean;
  invalid?: boolean;
  expect?: {
    cropped?: boolean;
    bled?: boolean;
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
    expect: {
      cropped: true,
      bled: true,
    },
  },
  {
    path: 'invalid',
    invalid: true,
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
      renamed: 'sprite4',
    },
  },
  {
    path: 'subfolder/suffixes/sprite5--nb',
    expect: {
      cropped: true,
      bled: false,
      renamed: 'sprite5',
    },
  },
  {
    path: 'subfolder/suffixes/sprite6--nb--nc',
    expect: {
      cropped: false,
      bled: false,
      renamed: 'sprite6',
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
  await deleteFolder(sandboxSource);
  await sandboxStaging.ensureDirectory();
  await sandboxSource.ensureDirectory();
  // Make a bunch of copies of sprites and spines
  // in the staging folder.
  for (const org of sandboxStagingOrg) {
    const source = org.spine
      ? sampleSpine
      : org.invalid
      ? sampleInvalidSprite
      : sampleSprite;
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

function startTimer() {
  return Date.now();
}

function endTimer(start: number, message?: string) {
  const diff = Date.now() - start;
  if (message) {
    console.log(`[${diff}ms] ${message}`);
  }
  return diff;
}

describe('Sprite Sources', function () {
  it('can list all subdirs', async function () {
    // Use the root of the monorepo, since that represents a large
    // number of subdirs.
    const root = '../../..';
    const start = startTimer();
    const dirs = await getDirs(root);
    endTimer(start, `Found ${dirs.length} dirs (async)`);
  });

  it('can import from a sprite source', async function () {
    await initializeSandbox();
    const source = new SpriteSource(sandboxSource);
    const renames = [
      {
        from: '(.*)(--[a-z]+)+',
        to: '$1',
      },
    ];
    const results = await source.import(sandboxProjectYyp, {
      staging: [
        {
          dir: '../staging',
          transforms: [
            {
              include: '--nb--nc|--nc--nb',
              synced: true,
              renames,
            },
            {
              include: '--nb',
              bleed: false,
              crop: true,
              renames,
            },
            {
              include: '--nc',
              bleed: true,
              crop: false,
              renames,
            },
            {
              bleed: true,
              crop: true,
            },
          ],
        },
      ],
    });
    if (source.issues.length) {
      console.error(source.issues);
    }
  });
});
