import { Pathy, pathy } from '@bscotch/pathy';
import { getModuleDir } from '@bscotch/utility';
import { StitchProject } from '../../lib/StitchProject.js';
import fs from '../../utility/files.js';
import paths from '../../utility/paths.js';

/*
Can be used to inform Stitch components that we are in
a development environment, for tweaking behavior if needed.
*/
process.env.GMS2PDK_DEV = 'true';
process.env.LOG_LEVEL = 'info';
process.env.DISPLAY_CWD = '../..';

/**
 * Stitch project root, for stable path identifiers
 */
export const root = pathy(getModuleDir(import.meta)).up(3);
const samplePath = root.join('samples');
const projectFolders = (await samplePath.listChildren()).filter((x) => {
	return x.basename.match(/^\d+\.\d+\.\d+\.\d+$/);
});

// Sample assets
/*
Tests require manipulating gamemaker project files.
There is a `samples/assets` folder for storing importable
assets, a `samples/module-source` folder containing a
GameMaker project to be used as a module source,
a `samples/project` folder containing a GameMaker project
to be manipulated in test cases, and finally a sandbox
folder that `sample-project` is copied into prior to each
test (to guarantee that we're always starting with the
same environment, and to prevent accidentally making
changes to the source project).
*/
export const modulesRoot = './samples/module-source/';
export const assetSampleRoot = './samples/assets/';
export const soundSampleRoot = root.join(assetSampleRoot, 'sounds').absolute;
export const spriteSampleRoot = root.join(assetSampleRoot, 'sprites').absolute;
export const soundSample = paths.join(soundSampleRoot, 'mus_intro_jingle.wav');

const testDataRoot = root.join('./src/test/data/').absolute;

const tempDir = root.join('tmp');

/**
 * To allow Typescript to infer that something exists,
 * we often need to wrap an (if(!exists){throw Error})
 * around it. This simple method makes that non-verbose.
 */
export function throwNever(): never {
	throw new Error('this should never happen');
}

export function readTestData(filePath: string) {
	return fs.readFileSync(`${testDataRoot}/${filePath}`, 'utf-8');
}

export async function resetTempDir(relativePath: string) {
	const projectDir = tempDir.join(relativePath);
	await projectDir.delete({ recursive: true, force: true });
	await projectDir.ensureDirectory();
	return projectDir;
}

/**
 * Get a project instance for a test/suite,
 * using `tempId` as the sandbox folder to prevent
 * collisions between tests. Use a random sample
 * project on each load.
 *
 * Running this function will reset the target sandbox.
 */
export async function loadCleanProject(
	tempId: string,
	options?: { readonly?: boolean },
) {
	const folder = await resetTempDir(tempId);
	const sampleProject = choose(projectFolders);
	await new Pathy(sampleProject).copy(folder);
	return await StitchProject.load({
		projectPath: folder.absolute,
		readOnly: options?.readonly,
		dangerouslyAllowDirtyWorkingDir: true,
	});
}

function choose<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

export async function expectToThrowAsync(
	fn: () => Promise<any>,
	message = 'Should throw an error.',
) {
	try {
		await fn();
	} catch (err) {
		return;
	}
	throw new Error(message);
}
