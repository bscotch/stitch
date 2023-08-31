import { expect } from 'chai';
import importFiles from '../cli/lib/add-files.js';
import importSounds from '../cli/lib/add-sounds.js';
import {
  assignAudioGroups,
  AssignCliOptions,
  assignTextureGroups,
} from '../cli/lib/assign.js';
import cli_assert from '../cli/lib/cli-assert.js';
import {
  Gms2MergeCliOptions,
  stitchCliMerge as importModules,
} from '../cli/lib/merge.js';
import version, { VersionOptions } from '../cli/lib/version.js';
import { StitchProject } from '../lib/StitchProject.js';
import { StitchAssertionError } from '../utility/errors.js';
import paths from '../utility/paths.js';
import {
  assetSampleRoot,
  loadCleanProject,
  modulesRoot,
  soundSample,
  soundSampleRoot,
} from './lib/util.js';

describe('CLI', function () {
  it('cannot import modules missing dependencies', async function () {
    const project = await loadCleanProject('cli-test');
    const importModulesOptions = {
      source: modulesRoot,
      ifFolderMatches: ['MissingDependency'],
      targetProject: project.yypDirAbsolute,
    };
    try {
      await importModules(importModulesOptions);
      throw new Error('Should fail when there is a missing dependency');
    } catch (err) {
      if (!(err instanceof StitchAssertionError)) {
        throw err;
      }
    }
    importModulesOptions.ifFolderMatches.push('BscotchPack');
    await importModules(importModulesOptions); // will throw if it fails
  });

  it('can import modules', async function () {
    const project = await loadCleanProject('cli-test');
    let incorrectImportModulesOtions = {
      source: 'fake_source_project_path',
      modules: ['BscotchPack', 'AnotherModule'],
      targetProject: project.yypDirAbsolute,
    };

    try {
      await importModules(incorrectImportModulesOtions);
      throw new Error('Should fail when source does not exists');
    } catch (err: any) {
      if (err?.code != 'ENOENT') {
        throw err;
      }
    }

    incorrectImportModulesOtions = {
      source: modulesRoot,
      modules: ['BscotchPack', 'AnotherModule'],
      targetProject: 'fake_target_project_path',
    };
    try {
      await importModules(incorrectImportModulesOtions);
      throw new Error(
        'Should fail when targetProject is entered but does not exists',
      );
    } catch (err: any) {
      if (err['code'] != 'ENOENT') {
        throw err;
      }
    }

    let importModulesOptions: Gms2MergeCliOptions = {
      source: modulesRoot,
      ifFolderMatches: ['BscotchPack', 'AnotherModule'],
      targetProject: project.yypDirAbsolute,
    };
    await importModules(importModulesOptions); // will throw if error

    await loadCleanProject('cli-test');
    importModulesOptions = {
      source: modulesRoot,
      ifFolderMatches: ['BscotchPack'],
      targetProject: project.yypDirAbsolute,
    };
    await importModules(importModulesOptions);
  });

  it('can import sounds', async function () {
    const project = await loadCleanProject('sound-import-test');
    const invalidOptions = {
      source: soundSampleRoot,
      extensions: [''],
      targetProject: project.yypDirAbsolute,
    };
    try {
      await importSounds(invalidOptions);
      throw new Error('Should not happen');
    } catch (err) {
      expect(err).to.be.an.instanceof(cli_assert.Gms2PipelineCliAssertionError);
    }

    const fileOptions = {
      source: soundSample,
      targetProject: project.yypDirAbsolute,
    };
    await importSounds(fileOptions);

    await loadCleanProject('cli-test');
    const folderOptions = {
      source: soundSampleRoot,
      targetProject: project.yypDirAbsolute,
    };
    await importSounds(folderOptions);

    await loadCleanProject('cli-test');
    const filteredOptions = {
      source: soundSampleRoot,
      extensions: ['wav'],
      targetProject: project.yypDirAbsolute,
    };
    await importSounds(filteredOptions);
  });

  it('can import files', async function () {
    const project = await loadCleanProject('cli-test');
    const options = {
      source: paths.join(assetSampleRoot, 'includedFiles', 'files'),
      targetProject: project.yypDirAbsolute,
    };
    await importFiles(options);
  });

  it('can set the project version', async function () {
    const project = await loadCleanProject('cli-test');
    const versionOptions: VersionOptions = {
      projectVersion: '100.5.6-rc.11',
      targetProject: project.yypPathAbsolute,
    };
    await version(versionOptions);
    expect(project.versionOnPlatform('windows')).to.equal('100.5.6.11');
  });

  it('can assign texture groups', async function () {
    let project = await loadCleanProject('cli-test');
    let sprite = project.resources.sprites[0];
    const newTextureGroupName = 'NewTextureGroup';
    const assignTextureOptions: AssignCliOptions = {
      folder: sprite.folder,
      groupName: newTextureGroupName,
      targetProject: project.yypDirAbsolute,
    };
    await assignTextureGroups(assignTextureOptions);

    project = await StitchProject.load({ projectPath: project.yypDirAbsolute });
    sprite = project.resources.sprites[0];
    // The new Texture page should exist
    expect(
      project.textureGroups.findByField('name', newTextureGroupName),
      'the new texture group should be added',
    ).to.exist;
    // The Sprite should be properly reassigned
    expect(sprite.textureGroup, 'sprite should be reassigned').to.equal(
      newTextureGroupName,
    );
  });

  it('can assign audio groups', async function () {
    let project = await loadCleanProject('cli-test');
    let sound = project.resources.sounds[0];
    const newAudioGroupName = 'NewAudioGroup';
    const assignAudioOptions: AssignCliOptions = {
      folder: sound.folder,
      groupName: newAudioGroupName,
      targetProject: project.yypDirAbsolute,
    };
    expect(
      sound.audioGroup,
      'sound should not be in target audio group',
    ).to.not.equal(newAudioGroupName);
    await assignAudioGroups(assignAudioOptions);

    project = await StitchProject.load({ projectPath: project.yypDirAbsolute });
    sound = project.resources.sounds[0];
    expect(
      project.audioGroups.findByField('name', newAudioGroupName),
      'the new audio group should be added',
    ).to.exist;
    // The Sprite should be properly reassigned
    expect(sound.audioGroup, 'sound should be reassigned').to.equal(
      newAudioGroupName,
    );
  });
});
