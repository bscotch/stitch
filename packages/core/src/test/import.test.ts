import { pathy, Pathy } from '@bscotch/pathy';
import { AssetSourcesConfig } from '../lib/assetSource/assetSource.js';
import { expect } from 'chai';
import { Gms2Room } from '../lib/components/resources/Gms2Room.js';
import { Gms2Sound } from '../lib/components/resources/Gms2Sound.js';
import { Gms2Sprite } from '../lib/components/resources/Gms2Sprite.js';
import { StitchProject } from '../lib/StitchProject.js';
import { assert, StitchError } from '../utility/errors.js';
import fs from '../utility/files.js';
import paths from '../utility/paths.js';
import {
  assetSampleRoot,
  expectToThrowAsync,
  loadCleanProject,
  soundSample,
  soundSampleRoot,
  spriteSampleRoot,
  throwNever,
} from './lib/util.js';

describe('GameMaker Project Imports', function () {
  it('will fail if importing non-existent included file', async function () {
    const project = await loadCleanProject('imports');
    // Attempt to add non-existent file
    expect(
      () => project.addIncludedFiles(soundSample + '-fake.mp3'),
      'attempting to add a non-existent file should throw',
    ).to.throw();
  });

  it('can update existing included files on import', async function () {
    const project = await loadCleanProject('imports');

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

  it('can import new included files', async function () {
    const project = await loadCleanProject('imports');

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
        project.yypDirAbsolute,
        fileResource.toJSON().filePath,
      );
      expect(
        fs.existsSync(datafileDir),
        'all imported files should exist in the actual datafiles path',
      ).to.be.true;
    }
  });

  it('can import new included files by extensions', async function () {
    const project = await loadCleanProject('imports');

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

  it('can add an IncludedFile using a data blob', async function () {
    const project = await loadCleanProject('imports');

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

  it('can import sprites', async function () {
    const project = await loadCleanProject('imports');
    expect(
      project.resources.findByName('mySprite'),
      'sprite should not exist before being added',
    ).to.not.exist;
    await project.addSprites(spriteSampleRoot, { case: 'camel' });
    const spriteNames = ['mySprite', 'excludedSprite', 'spine'];
    const sourceImages = await new Pathy(
      spriteSampleRoot,
    ).listChildrenRecursively({ includePatterns: [/\.png$/] });
    for (const spriteName of spriteNames) {
      const newSprite = project.resources.findByName(spriteName) as Gms2Sprite;
      expect(newSprite, `${spriteName} sprite should exist`).to.exist;
      if (newSprite.isSpine) {
        continue;
      }
      const expectedImages = sourceImages.filter((i) =>
        i.relative.includes(spriteName),
      );
      // Check the source and destination files
      const spriteDir = new Pathy(newSprite.yyDirAbsolute);
      const compositeImages = (await spriteDir.listChildren()).filter(
        (f) => f.extname === '.png',
      );
      const layerImages = await spriteDir.listChildrenRecursively({
        filter(p) {
          return (
            p.absolute.match(
              /\blayers\b[\\/]+[a-z0-9-]+[\\/]+[a-z0-9-]+\.png$/,
            ) || undefined
          );
        },
      });
      expect(
        expectedImages.length,
        'Should have same number of composite as source images.',
      ).to.equal(compositeImages.length);
      expect(
        expectedImages.length,
        'Should have same number of layer as source images.',
      ).to.equal(layerImages.length);
    }

    // Add the sprites to objects so that we can see them.
    const room = project.resources.findByName('the_room', Gms2Room);
    assert(room, `Room ${'the_room'} must exist.`);
    const waits = spriteNames.map(async (spriteName, i) => {
      const object = await project.addObject(`obj_${spriteName}`);
      object.spriteName = spriteName;
      // Put these objects into the room.
      const x = 200 + i * 100; // Need to put them SOMEWHERE, but non-overlapping
      room.addObjectInstance(object, x, x);
      return object;
    });
    await Promise.all(waits);
  });

  it('can re-import sprites', async function () {
    const project = await loadCleanProject('imports');
    expect(
      project.resources.findByName('mySprite'),
      'sprite should not exist before being added',
    ).to.not.exist;
    await project.addSprites(spriteSampleRoot, { case: 'camel' });
    const importedSprite = project.resources.findByName(
      'mySprite',
    ) as Gms2Sprite;
    expect(importedSprite).to.exist;

    const spriteFrameIds = importedSprite.frameIds;
    expect(spriteFrameIds.length).to.be.greaterThan(0);

    // Re-import
    const newProject = await StitchProject.load({
      projectPath: project.yypPathAbsolute,
      dangerouslyAllowDirtyWorkingDir: true,
    });
    await newProject.addSprites(spriteSampleRoot, { case: 'camel' });
    const reImportedSprite = newProject.resources.findByName(
      'mySprite',
    ) as Gms2Sprite;
    expect(reImportedSprite).to.exist;
    expect(reImportedSprite.frameIds.length).to.be.greaterThan(0);
    expect(spriteFrameIds).to.eql(reImportedSprite.frameIds);
  });

  it('can exclude imported sprites by pattern', async function () {
    const project = await loadCleanProject('imports');
    await project.addSprites(spriteSampleRoot, {
      case: 'camel',
      exclude: /^my/,
    });
    expect(project.resources.findByName('mySprite')).not.to.exist;
    expect(project.resources.findByName('excludedSprite')).to.exist;
  });

  it('can import sprites while prefixing and flattening names', async function () {
    const project = await loadCleanProject('imports');
    expect(
      project.resources.findByName('mySprite'),
      'sprite should not exist before being added',
    ).to.not.exist;
    await project.addSprites(spriteSampleRoot, {
      flatten: true,
      prefix: 'sp_',
      case: 'snake',
    });
    expect(project.resources.findByName('sp_this_is_my_sprite')).to.exist;
  });

  it('can batch add sound assets', async function () {
    let project = await loadCleanProject('imports');
    await expectToThrowAsync(
      () => project.addSounds(soundSampleRoot + '-fake.mp3'),
      'should not be able to batch add sounds from non-existing path',
    );
    const invalidAudioSample = paths.join(
      soundSampleRoot,
      'sfx_badgeunlock_m4a.m4a',
    );
    const invalidAudioSampleExt = paths.extname(invalidAudioSample).slice(1);
    await expectToThrowAsync(
      () =>
        project.addSounds(soundSampleRoot, {
          extensions: [invalidAudioSampleExt],
        }),
      'should not be able to batch add sounds with unsupported extensions.',
    );
    await project.addSounds(soundSampleRoot);
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
        paths.join(
          project.yypDirAbsolute,
          'sounds',
          resourceName,
          `${resourceName}.yy`,
        ),
      );
      expect(audio.yyPathAbsolute).to.equal(expectedResourceProjectPath);
      expect(audio.yyData.name).to.equal(resourceName);
    }

    project = await loadCleanProject('imports');
    const allowedExtensions = ['wav'];
    await project.addSounds(soundSampleRoot, { extensions: allowedExtensions });
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

  it('can batch add sound assets using a stitch.source.config', async function () {
    await pathy(soundSampleRoot).join(AssetSourcesConfig.basename).delete();
    const srcsConfig = AssetSourcesConfig.from(soundSampleRoot);
    const src = await srcsConfig.addAudioSource();
    expect(src.files.length).to.be.at.least(4);
    const project = await loadCleanProject('imports');
    let changed = await project.checkSoundSource(srcsConfig.path);

    // None are "importable" yet
    expect(changed.every((p) => !p.source.importable)).to.be.true;

    // Make importable
    await srcsConfig.toggleImportables(
      src.id,
      src.files.map((f) => f.id),
      true,
    );
    changed = await project.checkSoundSource(srcsConfig.path);
    expect(changed.length).to.be.at.least(4);
    expect(
      changed.every(
        (c) => c.source.importable && !c.areSame && c.change === 'added',
      ),
    ).to.be.true;

    // Import!
    await project.addSounds(srcsConfig.path.toString());
    for (const audioFile of [
      'sfx_badgeunlock_intro',
      'mus_intro_jingle',
      'sfx_badgeunlock_mp3',
      'sfx_badgeunlock_wma',
    ]) {
      const matchingSound = project.resources.findByName(audioFile);
      expect(matchingSound).to.exist;
      expect(matchingSound!.type === 'sounds').to.be.true;
    }

    // Now that they're imported, diff should turn up nothing.
    changed = await project.checkSoundSource(srcsConfig.path);
    expect(changed.length).to.be.at.least(4);
    expect(changed.every((c) => c.areSame)).to.be.true;
  });
});
