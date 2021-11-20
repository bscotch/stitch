import paths from '../../lib/paths';
import fs from '../../lib/files';
import { Gms2Project } from '../../lib/Gms2Project';

/*
Tests require manipulating gamemaker project files.
There is a `sample-assets` folder for storing importable
assets, a `sample-module-source` folder containing a
GameMaker project to be used as a module source,
a `sample-project` folder containing a GameMaker project
to be manipulated in test cases, and finally a sandbox
folder that `sample-project` is copied into prior to each
test (to guarantee that we're always starting with the
same environment, and to prevent accidentally making
changes to the source project).
*/
export const sandboxRoot = './sand box/'; // Use a space to ensure nothing bad happens when paths have a space
export const projectRoot = './sample-project/';
export const modulesRoot = './sample-module-source/';
export const sandboxProjectYYPPath = paths.join(
  sandboxRoot,
  'sample-project.yyp',
);

// Sample assets
export const assetSampleRoot = './sample-assets/';
export const soundSampleRoot = paths.join(assetSampleRoot, 'sounds');
export const spriteSampleRoot = paths.join(assetSampleRoot, 'sprites');
export const soundSample = paths.join(soundSampleRoot, 'mus_intro_jingle.wav');
export const testWorkingDir = process.cwd();

export const testDataRoot = './src/test/data/';

/**
 * To allow Typescript to infer that something exists,
 * we often need to wrap an (if(!exists){throw Error})
 * around it. This simple method makes that non-verbose.
 */
export function throwNever(): never {
  throw new Error('this should never happen');
}

export function readTestData(filePath: string) {
  return fs.readFileSync(`${testDataRoot}${filePath}`, 'utf-8');
}

/**
 * Replace all files in the sandbox with the original
 * source project, allowing for tests to start with
 * a clean slate.
 */
export function resetSandbox() {
  process.chdir(testWorkingDir);
  fs.ensureDirSync(sandboxRoot);
  try {
    fs.emptyDirSync(sandboxRoot);
  } catch (err) {
    console.log(err);
  }
  fs.copySync(projectRoot, sandboxRoot);
}

export function getResetProject(options?: { readonly?: boolean }) {
  resetSandbox();
  return new Gms2Project({
    projectPath: sandboxRoot,
    readOnly: options?.readonly,
  });
}
