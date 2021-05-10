import { expect } from 'chai';
import fs from '../lib/files';
import paths from '../lib/paths';
import { Gms2Project } from '../lib/Gms2Project';
import { loadFromFileSync } from '../lib/json';
import { Gms2Sound } from '../lib/components/resources/Gms2Sound';
import { differenceBy } from 'lodash';
import { StitchError, assert } from '../lib/errors';
import { Gms2Script } from '../lib/components/resources/Gms2Script';
import { Gms2Object } from '../lib/components/resources/Gms2Object';
import { SoundChannel, SoundCompression } from '../types/YySound';
import { Gms2Sprite } from '../lib/components/resources/Gms2Sprite';
import { Gms2Room } from '../lib/components/resources/Gms2Room';
import {
  assetSampleRoot,
  getResetProject,
  modulesRoot,
  sandboxProjectYYPPath,
  sandboxRoot,
  soundSample,
  soundSampleRoot,
  spriteSampleRoot,
  throwNever,
} from './lib/util';

const globalFunctionNames = ['Script1', 'Script2', 'preimport'];

describe('Gms2 Project Class', function () {
  it('can delete a resource', function () {
    const project = getResetProject({ readonly: true });
    const name = project.resources.all[0].name;
    expect(project.resources.findByName(name)).to.exist;
    project.deleteResourceByName(name);
    expect(project.resources.findByName(name)).to.not.exist;
    expect(project.toJSON().resources.find((r) => r.id.name == name)).to.not
      .exist;
  });

  it('can delete an included file', function () {
    const project = getResetProject();
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

  it('can hydrate and dehydrate the YYP file, resulting in the original data', function () {
    const project = getResetProject({ readonly: true });
    const rawContent = loadFromFileSync(project.yypAbsolutePath);
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
    expect(
      dehydrated,
      'dehydrated content should match the original yyp file',
    ).to.eql(rawContent);
    const rawKeys = Object.keys(rawContent);
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
  });

  it('can find global functions', function () {
    const project = getResetProject();
    const funcs = project.getGlobalFunctions();
    expect(funcs.length).to.equal(3);
    expect(funcs.map((f) => f.name)).to.eql(globalFunctionNames);
  });

  it('can find global function references', function () {
    // Add some references to the preimport script
    const project = getResetProject();
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
    expect(script1Refs.length).to.equal(3);
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

  it.only('can lint a project', function () {
    // Add some references to the preimport script
    const project = getResetProject();
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

  it('can create new folders', function () {
    const project = getResetProject();
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

  it('can add an object', function () {
    const project = getResetProject();
    const name = 'myRandomObject';

    // Ensure the object we're going to add doesn't already exist
    let object = project.resources.findByField('name', name, Gms2Object);
    expect(object, 'object should not exist before being added').to.not.exist;

    // Get a parent object and sprite to add later
    const sprite = project.resources.sprites[0];
    const parent = project.resources.objects[0];
    expect(sprite, 'sprite should exist').to.exist;
    expect(parent, 'parent object should exist').to.exist;

    project.addObject(name);
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

  it('can create new scripts', function () {
    const project = getResetProject();
    const name = 'helloWorld';
    const code = 'function hello (world){ return world;}';
    project.addScript(name, code);
    const script = project.resources.findByField('name', name, Gms2Script);
    if (!script) {
      throw new Error('script should have been added');
    }
    expect(script.code).to.equal(code);
  });

  it('can add a single sound asset', function () {
    const project = getResetProject();
    expect(
      () => project.addSounds(soundSample + 'fake_path'),
      'should not be able to upsert non-existing audio assets',
    ).to.throw();
    const invalidAudioSample = paths.join(
      soundSampleRoot,
      'sfx_badgeunlock_m4a.m4a',
    );
    expect(
      () => project.addSounds(invalidAudioSample),
      'should not be able to upsert audio assets with unsupported extensions.',
    ).to.throw();
    project.addSounds(soundSample);
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

  it('can modify a single sound asset', function () {
    const project = getResetProject();
    project.addSounds(soundSample);
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

  it('can batch add sound assets', function () {
    let project = getResetProject();
    expect(
      () => project.addSounds(soundSampleRoot + '-fake.mp3'),
      'should not be able to batch add sounds from non-existing path',
    ).to.throw();
    const invalidAudioSample = paths.join(
      soundSampleRoot,
      'sfx_badgeunlock_m4a.m4a',
    );
    const invalidAudioSampleExt = paths.extname(invalidAudioSample).slice(1);
    expect(
      () => project.addSounds(soundSampleRoot, [invalidAudioSampleExt]),
      'should not be able to batch add sounds with unsupported extensions.',
    ).to.throw();
    project.addSounds(soundSampleRoot);
    const batchAudioSampleNames = [
      'sfx_badgeunlock_intro.ogg',
      'mus_intro_jingle.wav',
      'sfx_badgeunlock_mp3.mp3',
      'sfx_badgeunlock_wma.wma',
    ];
    // Questions:
    //   Is the sound in the yyp?
    for (const batchAudioSampleName of batchAudioSampleNames) {
      const audio = project.resources.findByField(
        'name',
        paths.parse(batchAudioSampleName).name,
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
      const resourceName = audio.name;
      const expectedResourceProjectPath = paths.resolve(
        paths.join(sandboxRoot, 'sounds', resourceName, `${resourceName}.yy`),
      );
      expect(audio.yyPathAbsolute).to.equal(expectedResourceProjectPath);
    }

    project = getResetProject();
    const allowedExtensions = ['wav'];
    project.addSounds(soundSampleRoot, allowedExtensions);
    for (const batchAudioSampleName of batchAudioSampleNames) {
      const extension = paths.extname(batchAudioSampleName).slice(1);
      const isAllowedExtension = allowedExtensions.includes(extension);
      const audio = project.resources.findByField(
        'name',
        paths.parse(batchAudioSampleName).name,
        Gms2Sound,
      );
      if (isAllowedExtension) {
        expect(audio, 'Allowed extension should be upserted').to.exist;
        if (!audio) {
          throwNever();
        }
        expect(fs.existsSync(audio.yyPathAbsolute), '.yy file should exist').to
          .be.true;
        expect(
          fs.existsSync(audio.audioFilePathAbsolute),
          'audio file should exist',
        ).to.be.true;
      } else {
        expect(audio, 'Non-allowed extensions should not be upserted').to.not
          .exist;
      }
    }
  });

  it('can create a new texture group', function () {
    const project = getResetProject();
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

  it('can create a new audio group', function () {
    const project = getResetProject();
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

  it('can create texture group assignments', function () {
    const project = getResetProject();
    const newTextureGroupName = 'NewTextureGroup';
    const sprite = project.resources.sprites[0];
    expect(
      sprite.textureGroup,
      'sprite should not be in target texture group',
    ).to.not.equal(newTextureGroupName);
    project.addTextureGroupAssignment(sprite.folder, newTextureGroupName);
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

  it('can create audio group assignments', function () {
    const project = getResetProject();
    const newAudioGroupName = 'NewAudioGroup';
    const sound = project.resources.sounds[0];
    expect(
      sound.audioGroup,
      'sound should not be in target audio group',
    ).to.not.equal(newAudioGroupName);
    project.addAudioGroupAssignment(sound.folder, newAudioGroupName);
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

  it('will fail if importing non-existent included file', function () {
    const project = new Gms2Project(sandboxRoot);
    // Attempt to add non-existent file
    expect(
      () => project.addIncludedFiles(soundSample + '-fake.mp3'),
      'attempting to add a non-existent file should throw',
    ).to.throw();
  });

  it('can update existing included files on import', function () {
    const project = getResetProject();

    const filesDir = `${assetSampleRoot}/includedFiles`;

    // Add a file that already exists
    const existingFilePath = `shared/shared.txt`;
    const sharedFileSourceContent = 'This content should get copied over.';
    const sharedFile = project.includedFiles.findByField('name', 'shared.txt');
    if (!sharedFile) {
      throw new StitchError(`shared file should exist`);
    }
    expect(
      sharedFile.contentAsBuffer,
      'shared file before copy should be empty',
    ).to.eql(Buffer.from([]));
    project.addIncludedFiles(`${filesDir}/${existingFilePath}`, {
      subdirectory: 'shared',
    });
    expect(sharedFile.contentAsBuffer.toString()).to.eql(
      sharedFileSourceContent,
    );
  });

  it('can import new included files', function () {
    const project = getResetProject();

    // Add all files from a directory
    const filesDir = `${assetSampleRoot}/includedFiles/files`;
    const subdir = 'BscotchPack';
    project.addIncludedFiles(filesDir, { subdirectory: subdir });
    const expectedFilePaths = fs.listFilesSync(filesDir, true);
    const expectedFileNames = expectedFilePaths.map(
      (filePath) => paths.parse(filePath).base,
    );
    for (const filePath of expectedFileNames) {
      const fileResource = project.includedFiles.findByField('name', filePath);
      if (!fileResource) {
        console.log('all imported files should exist in the project resource');
        throwNever();
      }
      const datafileDir = paths.join(
        sandboxRoot,
        fileResource.toJSON().filePath,
      );
      expect(
        fs.existsSync(datafileDir),
        'all imported files should exist in the actual datafiles path',
      ).to.be.true;
    }
  });

  it('can import new included files by extensions', function () {
    const project = getResetProject();

    // Add all files from a directory
    const filesDir = `${assetSampleRoot}/includedFiles/files`;
    const allowedExtensions = ['json', 'md'];
    project.addIncludedFiles(filesDir, {
      subdirectory: 'BscotchPack',
      allowedExtensions,
    });
    const availableFiles = fs
      .listFilesSync(filesDir)
      .map((filePath) => paths.parse(filePath).base);
    for (const filePath of availableFiles) {
      const fileExtension = paths.extname(filePath).slice(1);
      const res = project.includedFiles.findByField('name', filePath);
      if (allowedExtensions.includes(fileExtension)) {
        expect(res, 'all imported files should exist').to.exist;
      } else {
        expect(res, 'all imported files should exist').to.not.exist;
      }
    }
  });

  it('can add an IncludedFile using a data blob', function () {
    const project = getResetProject();

    const binaryExample = Buffer.from([1, 2, 3]);
    expect(
      project.addIncludedFiles('binary', { content: binaryExample })[0]
        .contentAsBuffer,
    ).to.eql(binaryExample);

    const textExample = 'hello';
    expect(
      project.addIncludedFiles('text', { content: textExample })[0]
        .contentAsString,
    ).to.eql(textExample);

    const jsonExample = { hello: [1, 2, 3] };
    expect(
      project.addIncludedFiles('json', { content: jsonExample })[0]
        .contentParsedAsJson,
    ).to.eql(jsonExample);
  });

  it('can import sprites', function () {
    const project = getResetProject();
    expect(
      project.resources.findByName('mySprite'),
      'sprite should not exist before being added',
    ).to.not.exist;
    project.addSprites(spriteSampleRoot, { case: 'camel' });
    const spriteNames = ['mySprite', 'excludedSprite', 'spine'];
    for (const spriteName of spriteNames) {
      expect(
        project.resources.findByName(spriteName),
        `${spriteName} mySprite should exist`,
      ).to.exist;
    }

    // Add the sprites to objects so that we can see them.
    const room = project.resources.findByName('the_room', Gms2Room);
    assert(room, `Room ${'the_room'} must exist.`);
    spriteNames.forEach((spriteName, i) => {
      const object = project.addObject(`obj_${spriteName}`);
      object.spriteName = spriteName;
      // Put these objects into the room.
      const x = 200 + i * 100; // Need to put them SOMEWHERE, but non-overlapping
      room.addObjectInstance(object, x, x);
      return object;
    });
  });

  it('can re-import sprites', function () {
    const project = getResetProject();
    expect(
      project.resources.findByName('mySprite'),
      'sprite should not exist before being added',
    ).to.not.exist;
    project.addSprites(spriteSampleRoot, { case: 'camel' });
    const importedSprite = project.resources.findByName(
      'mySprite',
    ) as Gms2Sprite;
    const spriteFrameIds = importedSprite.frameIds;
    // Re-import
    const newProject = new Gms2Project({ projectPath: sandboxRoot });
    newProject.addSprites(spriteSampleRoot, { case: 'camel' });
    const reImportedSprite = newProject.resources.findByName(
      'mySprite',
    ) as Gms2Sprite;
    const reImportedSpriteFrameIds = reImportedSprite.frameIds;
    expect(spriteFrameIds).to.eql(reImportedSpriteFrameIds);
  });

  it('can exclude imported sprites by pattern', function () {
    const project = getResetProject();
    project.addSprites(spriteSampleRoot, { case: 'camel', exclude: /^my/ });
    expect(project.resources.findByName('mySprite')).not.to.exist;
    expect(project.resources.findByName('excludedSprite')).to.exist;
  });

  it('can import sprites while prefixing and flattening names', function () {
    const project = getResetProject();
    expect(
      project.resources.findByName('mySprite'),
      'sprite should not exist before being added',
    ).to.not.exist;
    project.addSprites(spriteSampleRoot, {
      flatten: true,
      prefix: 'sp_',
      case: 'snake',
    });
    expect(project.resources.findByName('sp_this_is_my_sprite')).to.exist;
  });

  it('can import modules from one project into another', function () {
    const targetProject = getResetProject({ readonly: true });
    const ifFolderMatches = ['BscotchPack', 'AnotherModule'];

    // Initial state
    const project = new Gms2Project(sandboxProjectYYPPath);
    const resourcesToImport = targetProject.resources
      .filter((resource) => {
        return ifFolderMatches.some((match) => resource.folder.includes(match));
      })
      .map((resource) => resource.toJSON());
    expect(
      project.configs.findChild('BscotchPack'),
      'BscotchPack config should not exist before import',
    ).to.not.exist;

    // IMPORT
    project.merge(modulesRoot, { ifFolderMatches });

    // Check Resources
    const unexported = differenceBy(
      project.resources.toJSON(),
      resourcesToImport,
      'name',
    );
    expect(
      unexported.length,
      'every module asset should have been imported',
    ).to.equal(0);

    // Check IncludedFiles
    expect(
      project.configs.findChild('BscotchPack'),
      'BscotchPack config should be imported',
    ).to.exist;
    const resourceData = project.includedFiles.findByField(
      'name',
      'moduleFile.txt',
    );
    if (!resourceData) {
      console.log('included file should be imported');
      throwNever();
    }
    const datafileDir = paths.join(sandboxRoot, resourceData.toJSON().filePath);
    expect(
      fs.existsSync(datafileDir),
      'The imported files should exist in the actual datafiles path',
    );

    // IMPORT AGAIN to trigger no-overwrite-if-same checks
    project.merge(modulesRoot, { ifFolderMatches });
  });

  it('can whitelist asset types to import', function () {
    const targetProject = getResetProject({ readonly: true });
    const sourceProject = new Gms2Project({
      readOnly: true,
      projectPath: modulesRoot,
    });
    const initialResources = targetProject.resources.all;
    const sourceObjects = sourceProject.resources.objects;
    const finalResources = targetProject.merge(modulesRoot, {
      types: ['objects'],
    }).resources.all;
    const addedResources = differenceBy(
      finalResources,
      initialResources,
      'name',
    );
    expect(sourceObjects.map((o) => o.name)).to.eql(
      addedResources.map((o) => o.name),
    );
  });

  it('can import *all* assets from a project', function () {
    getResetProject({ readonly: true });

    // Initial state
    const project = new Gms2Project(sandboxProjectYYPPath);
    project.merge(modulesRoot);

    // Check IncludedFiles
    expect(
      project.configs.findChild('BscotchPack'),
      'BscotchPack config should be imported',
    ).to.exist;
    const resourceData = project.includedFiles.findByField(
      'name',
      'moduleFile.txt',
    );
    if (!resourceData) {
      console.log('included file should be imported');
      throwNever();
    }
    const datafileDir = paths.join(sandboxRoot, resourceData.toJSON().filePath);
    expect(
      fs.existsSync(datafileDir),
      'The imported files should exist in the actual datafiles path',
    );
  });

  it('can set the version in options files', function () {
    const project = getResetProject();
    const testPlatforms = Gms2Project.platforms;
    const version = '100.5.6-rc.11';
    project.version = version;
    for (const platform of testPlatforms) {
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
