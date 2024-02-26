import { Pathy } from '@bscotch/pathy';
import { SoundChannel, SoundCompression, Yy } from '@bscotch/yy';
import { expect } from 'chai';
import { StitchProject } from '../lib/StitchProject.js';
import { Gms2Object } from '../lib/components/resources/Gms2Object.js';
import { Gms2Room } from '../lib/components/resources/Gms2Room.js';
import { Gms2Script } from '../lib/components/resources/Gms2Script.js';
import { Gms2Sound } from '../lib/components/resources/Gms2Sound.js';
import { StitchError, assert } from '../utility/errors.js';
import fs from '../utility/files.js';
import paths from '../utility/paths.js';
import {
  expectToThrowAsync,
  loadCleanProject,
  soundSample,
  soundSampleRoot,
  throwNever,
} from './lib/util.js';

const globalFunctionNames = ['Script1', 'Script2', 'preimport'];

describe('Gms2 Project Class', function () {
  it('can delete a resource', async function () {
    const project = await loadCleanProject('project-class', { readonly: true });
    const name = project.resources.all[0].name;
    expect(project.resources.findByName(name)).to.exist;
    project.deleteResourceByName(name);
    expect(project.resources.findByName(name)).to.not.exist;
    expect(project.toJSON().resources.find((r) => r.id.name == name)).to.not
      .exist;
  });

  it('can delete an included file', async function () {
    const project = await loadCleanProject('project-class');
    const file = project.includedFiles.list()[0];
    expect(file, 'file must exist to be deleted').to.exist;
    project.deleteIncludedFileByName(file.name);
    expect(
      project.includedFiles.find((f) => f.name == file.name),
      'file should not be in yyp',
    ).to.be.undefined;
    expect(
      fs.existsSync(file.filePathAbsolute),
      'file should not exist on disk',
    ).to.be.false;
  });

  it('can hydrate and dehydrate the YYP file, resulting in the original data', async function () {
    const project = await loadCleanProject('project-class', { readonly: true });
    const directContent = Yy.readSync(project.yypPathAbsolute, 'project');
    const dehydrated = project.toJSON();
    // Note: Projects always ensure that "/NEW" (folder) exists,
    // so delete it before making sure we got back what we put in
    // (since it does not exist in the original)
    const newStuffFolderIdx = dehydrated.Folders.findIndex(
      (f) => f.name == 'NEW',
    );
    expect(newStuffFolderIdx, 'A /NEW folder should exist').to.be.greaterThan(
      -1,
    );
    dehydrated.Folders.splice(newStuffFolderIdx, 1);
    const rawKeys = Object.keys(directContent);
    rawKeys.sort();
    const dehydratedKeys = Object.keys(dehydrated);
    dehydratedKeys.sort();
    expect(
      [1, 2, 3],
      'array deep equality check should require same order',
    ).to.not.eql([2, 1, 3]);
    expect(rawKeys, 'dehydrated projects should have the same keys').to.eql(
      dehydratedKeys,
    );
    expect(
      dehydrated,
      'dehydrated content should match the original yyp file',
    ).to.eql(directContent);
  });

  it('can find global functions', async function () {
    const project = await loadCleanProject('project-class');
    const funcs = project.getGlobalFunctions();
    expect(funcs.length).to.equal(3);
    expect(funcs.map((f) => f.name)).to.eql(globalFunctionNames);
  });

  it('can find global function references', async function () {
    // Add some references to the preimport script
    const project = await loadCleanProject('project-class');
    const script = project.resources.findByName('preimport', Gms2Script);
    assert(script);
    script.code += `\n\nScript1();\n\nScript2_v3();`;

    const funcs = project.findGlobalFunctionReferences({
      versionSuffix: '(_v\\d+)?',
    });
    expect(funcs.length).to.equal(3);
    expect(funcs.map((func) => func.token.name)).to.eql(globalFunctionNames);
    // We expect Script1 to appear in:
    //  + the Create_0 event of 'object'
    //  + the 'the_script' script (called by Script2)
    //  + the 'preimport' script (added in this test)
    // We expect Script2 to appear in:
    //  + the Draw_0 event of 'object'
    //  + the 'preimport' script (added in this test) with a DIFFERENT VERSION
    // We expect preimport to appear in:
    //  + NOWHERE (TODO: maybe it's in room code)

    // Script1
    const script1Refs = funcs[0].references;
    // expect(script1Refs.length).to.equal(3);
    expect(script1Refs.every((r) => r.isCorrectVersion)).to.be.true;
    expect(
      script1Refs.find((r) => r.location.resource!.name == 'object')!.location
        .subresource,
    ).to.equal('Create_0');
    expect(script1Refs.find((r) => r.location.resource!.name == 'the_script'))
      .to.exist;
    expect(script1Refs.find((r) => r.location.resource!.name == 'preimport')).to
      .exist;

    // Script2
    const script2Refs = funcs[1].references;
    expect(script2Refs.length).to.equal(2);
    expect(script2Refs.every((r) => r.isCorrectVersion)).to.be.false;
    expect(
      script2Refs.find((r) => r.location.resource!.name == 'object')!.location
        .subresource,
    ).to.equal('Draw_0');
    expect(
      script2Refs.find((r) => r.location.resource!.name == 'preimport')!
        .isCorrectVersion,
    ).to.equal(false);

    // preimport
    const preimportRefs = funcs[2].references;
    expect(preimportRefs.length).to.equal(0);
  });

  it('can lint a project', async function () {
    // Add some references to the preimport script
    const project = await loadCleanProject('project-class');
    const script = project.resources.findByName('preimport', Gms2Script);
    const outdatedReference = 'Script2_v3';
    assert(script);
    script.code += `\n\nScript1();\n\n${outdatedReference}();`;
    const lintResults = project.lint({ versionSuffix: '(_v\\d+)?' });
    const results = lintResults.getReport();
    expect(results.nonreferencedFunctions![0].name).to.equal('preimport');
    expect(results.outdatedFunctionReferences![0].name).to.equal(
      outdatedReference,
    );
    console.log(lintResults.getReportString());
  });

  it('can create new folders', async function () {
    const project = await loadCleanProject('project-class');
    const newFolders = ['hello/world', 'deeply/nested/folder/structure'];
    for (const newFolder of newFolders) {
      project.addFolder(newFolder);
    }
    const projectFolders = project.toJSON().Folders;
    const allExpectedFolders = newFolders
      .map((f) => paths.heirarchy(f))
      .flat(3);
    expect(allExpectedFolders.length).to.equal(6);
    for (const expectedFolder of allExpectedFolders) {
      const folderInProject = projectFolders.find(
        (f) => f.folderPath == `folders/${expectedFolder}.yy`,
      );
      expect(folderInProject, `Folder ${expectedFolder} should have been added`)
        .to.exist;
    }
  });

  it('can add a room', async function () {
    const project = await loadCleanProject('project-class');
    const name = 'new_room';
    const room = await project.addRoom(name);
    expect(room.name).to.equal(name);
    expect(project.resources.findByName(name, Gms2Room)).to.exist;
    expect(new Pathy(room.yyPathAbsolute).existsSync()).to.be.true;
  });

  it('can add an object', async function () {
    const project = await loadCleanProject('project-class');
    const name = 'myRandomObject';

    // Ensure the object we're going to add doesn't already exist
    let object = project.resources.findByField('name', name, Gms2Object);
    expect(object, 'object should not exist before being added').to.not.exist;

    // Get a parent object and sprite to add later
    const sprite = project.resources.sprites[0];
    const parent = project.resources.objects[0];
    expect(sprite, 'sprite should exist').to.exist;
    expect(parent, 'parent object should exist').to.exist;

    await project.addObject(name);
    object = project.resources.findByField('name', name, Gms2Object);
    if (!object) {
      throw new StitchError('object should have been added');
    }

    // Update the object's parent and sprite.
    object.spriteName = sprite.name;
    object.parentName = parent.name;
    expect(object.spriteName).to.equal(sprite.name);
    expect(object.parentName).to.equal(parent.name);
  });

  it('can create new scripts', async function () {
    const project = await loadCleanProject('project-class');
    const name = 'helloWorld';
    const code = 'function hello (world){ return world;}';
    await project.addScript(name, code);
    const script = project.resources.findByField('name', name, Gms2Script);
    if (!script) {
      throw new Error('script should have been added');
    }
    expect(script.code).to.equal(code);
  });

  it('can add a single sound asset', async function () {
    const project = await loadCleanProject('project-class');
    await expectToThrowAsync(
      () => project.addSounds(soundSample + 'fake_path'),
      'should not be able to upsert non-existing audio assets',
    );
    const invalidAudioSample = paths.join(
      soundSampleRoot,
      'sfx_badgeunlock_m4a.m4a',
    );
    await expectToThrowAsync(
      () => project.addSounds(invalidAudioSample),
      'should not be able to upsert audio assets with unsupported extensions.',
    );
    await project.addSounds(soundSample);
    // Questions:
    //   Is the sound in the yyp?
    const audio = project.resources.findByField(
      'name',
      paths.parse(soundSample).name,
      Gms2Sound,
    );
    expect(audio, 'New audio should be upserted').to.exist;
    if (!audio) {
      throwNever();
    }
    //   Does the sound .yy exist?
    expect(fs.existsSync(audio.yyPathAbsolute), '.yy file should exist').to.be
      .true;
    //   Does the audio file exist?
    expect(
      fs.existsSync(audio.audioFilePathAbsolute),
      'audio file should exist',
    ).to.be.true;
  });

  it('can modify a single sound asset', async function () {
    const project = await loadCleanProject('project-class');
    await project.addSounds(soundSample);
    const audio = project.resources.findByField(
      'name',
      paths.parse(soundSample).name,
      Gms2Sound,
    );
    if (!audio) {
      throw new Error('audio should have been added');
    }
    //Changing channels
    audio.channels = 'Mono';
    expect(audio?.channels).to.equal('Mono');
    expect(audio?.channelsAsIndex()).to.equal(SoundChannel.Mono);
    audio.channels = 'Stereo';
    expect(audio?.channels).to.equal('Stereo');
    expect(audio?.channelsAsIndex()).to.equal(SoundChannel.Stereo);

    //Changing compressions
    audio.compression = 'Compressed';
    expect(audio?.compression).to.equal('Compressed');
    expect(audio?.compressionAsIndex()).to.equal(SoundCompression.Compressed);
    audio.compression = 'UncompressedOnLoad';
    expect(audio?.compression).to.equal('UncompressedOnLoad');
    expect(audio?.compressionAsIndex()).to.equal(
      SoundCompression.UncompressedOnLoad,
    );
  });

  it('can create a new texture group', async function () {
    const project = await loadCleanProject('project-class');
    const newTextureGroupName = 'NewTextureGroup';
    // Create the texture group
    expect(
      project.textureGroups.findByField('name', newTextureGroupName),
      'the new texture group should not already exist',
    ).to.not.exist;
    project.addTextureGroup(newTextureGroupName);
    expect(
      project.textureGroups.findByField('name', newTextureGroupName),
      'the new texture group should be added',
    ).to.exist;
  });

  it('can create a new audio group', async function () {
    const project = await loadCleanProject('project-class');
    const newAudioGroupName = 'NewAudioGroup';
    // Create the texture group
    expect(
      project.audioGroups.findByField('name', newAudioGroupName),
      'the new audio group should not already exist',
    ).to.not.exist;
    project.addAudioGroup(newAudioGroupName);
    expect(
      project.audioGroups.findByField('name', newAudioGroupName),
      'the new audio group should be added',
    ).to.exist;
  });

  it('can create texture group assignments', async function () {
    const project = await loadCleanProject('project-class');
    const newTextureGroupName = 'NewTextureGroup';
    const sprite = project.resources.sprites[0];
    expect(
      sprite.textureGroup,
      'sprite should not be in target texture group',
    ).to.not.equal(newTextureGroupName);
    await project.addTextureGroupAssignment(sprite.folder, newTextureGroupName);
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

  it('can create audio group assignments', async function () {
    const project = await loadCleanProject('project-class');
    const newAudioGroupName = 'NewAudioGroup';
    const sound = project.resources.sounds[0];
    expect(
      sound.audioGroup,
      'sound should not be in target audio group',
    ).to.not.equal(newAudioGroupName);
    await project.addAudioGroupAssignment(sound.folder, newAudioGroupName);
    // The new Texture page should exist
    expect(
      project.audioGroups.findByField('name', newAudioGroupName),
      'the new audio group should be added',
    ).to.exist;
    // The Sprite should be properly reassigned
    expect(sound.audioGroup, 'sound should be reassigned').to.equal(
      newAudioGroupName,
    );
  });

  it('can set the version in options files', async function () {
    const project = await loadCleanProject('project-class');
    const testPlatforms = StitchProject.platforms;
    const version = '100.5.6-rc.11';
    project.version = version;
    for (const platform of testPlatforms) {
      if (platform === 'ps4') continue;
      expect(
        project.versionOnPlatform(platform),
        `${platform}'s version is not set.`,
      ).to.equal('100.5.6.11');
    }
    // Ensure version formats generally work (errors thrown if they don't)
    for (const validVersion of ['10.0.10', '5.3.6.1', '100.9.3-rc.3333']) {
      project.version = validVersion;
    }
    // Test a handful of invalid formats
    for (const invalidVersion of [
      '10.0.10.9.9',
      '.5.3.5',
      '100.9.3-hotfix.3333',
      '1.1.1.1-rc.1',
    ]) {
      expect(() => (project.version = invalidVersion)).to.throw();
    }
  });
});
