import { expect } from 'chai';
import paths from '../lib/paths';
import { Gms2Project } from '../lib/Gms2Project';
import { StitchAssertionError } from '../lib/errors';
import cli_assert from '../cli/lib/cli-assert';
import importModules, { Gms2MergeCliOptions } from '../cli/lib/merge';
import importSounds from '../cli/lib/add-sounds';
import version, { VersionOptions } from '../cli/lib/version';
import importFiles from '../cli/lib/add-files';
import {
  assignAudioGroups,
  assignTextureGroups,
  AssignCliOptions,
} from '../cli/lib/assign';
import {
  assetSampleRoot,
  getResetProject,
  modulesRoot,
  resetSandbox,
  sandboxProjectYYPPath,
  sandboxRoot,
  soundSample,
  soundSampleRoot,
} from './lib/util';

describe('CLI', function () {
  it('cannot import modules missing dependencies', async function () {
    resetSandbox();
    const importModulesOptions = {
      source: modulesRoot,
      ifFolderMatches: ['MissingDependency'],
      targetProject: sandboxRoot,
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
    resetSandbox();
    let incorrectImportModulesOtions = {
      source: 'fake_source_project_path',
      modules: ['BscotchPack', 'AnotherModule'],
      targetProject: sandboxRoot,
    };

    try {
      await importModules(incorrectImportModulesOtions);
      throw new Error('Should fail when source does not exists');
    } catch (err) {
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
    } catch (err) {
      if (!(err instanceof cli_assert.Gms2PipelineCliAssertionError)) {
        throw err;
      }
    }

    let importModulesOptions: Gms2MergeCliOptions = {
      source: modulesRoot,
      ifFolderMatches: ['BscotchPack', 'AnotherModule'],
      targetProject: sandboxRoot,
    };
    await importModules(importModulesOptions); // will throw if error

    resetSandbox();
    importModulesOptions = {
      source: modulesRoot,
      ifFolderMatches: ['BscotchPack'],
      targetProject: sandboxRoot,
    };
    await importModules(importModulesOptions);
  });

  it('can import modules from a remote repo', async function () {
    this.timeout(10000);
    resetSandbox();
    await importModules({
      types: ['scripts'],
      sourceGithub: 'gm-core/gdash@6.0.2',
      targetProject: sandboxRoot,
    });
    const project = new Gms2Project({
      projectPath: sandboxRoot,
      readOnly: true,
    });
    expect(project.resources.findByName('_reverse')).to.exist;
    expect(project.resources.findByName('preimport')).to.exist;
  });

  it('can import sounds', function () {
    resetSandbox();
    const invalidOptions = {
      source: soundSampleRoot,
      extensions: [''],
      targetProject: sandboxRoot,
    };
    expect(
      () => importSounds(invalidOptions),
      'Should fail when providing no valid extensions.',
    ).to.throw(cli_assert.Gms2PipelineCliAssertionError);

    const fileOptions = {
      source: soundSample,
      targetProject: sandboxRoot,
    };
    expect(
      () => importSounds(fileOptions),
      'Should succeed when source path points to a valid file',
    ).to.not.throw();

    resetSandbox();
    const folderOptions = {
      source: soundSampleRoot,
      targetProject: sandboxRoot,
    };
    expect(
      () => importSounds(folderOptions),
      'Should succeed when source path points to a valid folder',
    ).to.not.throw();

    resetSandbox();
    const filteredOptions = {
      source: soundSampleRoot,
      extensions: ['wav'],
      targetProject: sandboxRoot,
    };
    expect(
      () => importSounds(filteredOptions),
      'Should succeed when source path points to a valid folder and importing only a subset of extensions.',
    ).to.not.throw();
  });

  it('can import files', function () {
    resetSandbox();
    const options = {
      source: paths.join(assetSampleRoot, 'includedFiles', 'files'),
      targetProject: sandboxRoot,
    };
    expect(
      () => importFiles(options),
      'Should succeed when source path points to a valid folder',
    ).to.not.throw();
  });

  it('can set the project version', function () {
    const project = getResetProject();
    const versionOptions: VersionOptions = {
      projectVersion: '100.5.6-rc.11',
      targetProject: sandboxRoot,
    };
    expect(
      () => version(versionOptions),
      'Should succeed when version is valid',
    ).to.not.throw();
    expect(project.versionOnPlatform('windows')).to.equal('100.5.6.11');
  });

  it('can assign texture groups', function () {
    let project = getResetProject();
    let sprite = project.resources.sprites[0];
    const newTextureGroupName = 'NewTextureGroup';
    const assignTextureOptions: AssignCliOptions = {
      folder: sprite.folder,
      groupName: newTextureGroupName,
      targetProject: sandboxRoot,
    };
    expect(
      () => assignTextureGroups(assignTextureOptions),
      'Should succeed when the arguments are correct',
    ).to.not.throw();

    project = new Gms2Project(sandboxProjectYYPPath);
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

  it('can assign audio groups', function () {
    let project = getResetProject();
    let sound = project.resources.sounds[0];
    const newAudioGroupName = 'NewAudioGroup';
    const assignAudioOptions: AssignCliOptions = {
      folder: sound.folder,
      groupName: newAudioGroupName,
      targetProject: sandboxRoot,
    };
    expect(
      sound.audioGroup,
      'sound should not be in target audio group',
    ).to.not.equal(newAudioGroupName);
    expect(
      () => assignAudioGroups(assignAudioOptions),
      'Should succeed when the arguments are correct',
    ).to.not.throw();

    project = new Gms2Project(sandboxProjectYYPPath);
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
