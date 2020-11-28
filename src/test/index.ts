import { expect } from 'chai';
import fs from '../lib/files';
import paths from '../lib/paths';
import { Gms2Project } from '../lib/Gms2Project';
import {loadFromFileSync} from "../lib/json";
import { Gms2Sound } from '../lib/components/resources/Gms2Sound';
import { differenceBy } from 'lodash';
import { StitchError, StitchAssertionError } from '../lib/errors';
import { Gms2Script } from '../lib/components/resources/Gms2Script';
import cli_assert from '../cli/lib/cli-assert';
import importModules, { ImportModuleOptions } from '../cli/lib/import-modules';
import importSounds from '../cli/lib/add-sounds';
import version, {VersionOptions} from '../cli/lib/version';
import importFiles from '../cli/lib/add-files';
import {assignAudioGroups, assignTextureGroups, AssignCliOptions} from '../cli/lib/assign';
import { Gms2Object } from '../lib/components/resources/Gms2Object';
import {jsonify as stringify} from "../lib/jsonify";
import { undent } from '@bscotch/utility';
import { NumberFixed } from '../lib/NumberFixed';
import { SoundChannel, SoundCompression } from '../types/YySound';
import {get, unzipRemote} from "../lib/http";

/*
Can be used to inform Stitch components that we are in
a development environment, for tweaking behavior if needed.
*/
process.env.GMS2PDK_DEV = 'true';

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
const sandboxRoot = './sand box/'; // Use a space to ensure nothing bad happens when paths have a space
const projectRoot = './sample-project/';
const modulesRoot = "./sample-module-source/";
const sandboxProjectYYPPath = paths.join(sandboxRoot, 'sample-project.yyp');

// Sample assets
const assetSampleRoot = './sample-assets/';
const soundSampleRoot = paths.join(assetSampleRoot, "sounds");
const spriteSampleRoot = paths.join(assetSampleRoot, "sprites");
const soundSample = paths.join(soundSampleRoot,"mus_intro_jingle.wav");
const testWorkingDir = process.cwd();

/**
 * To allow Typescript to infer that something exists,
 * we often need to wrap an (if(!exists){throw Error})
 * around it. This simple method makes that non-verbose.
 */
function throwNever():never{
  throw new Error("this should never happen");
}

/**
 * Replace all files in the sandbox with the original
 * source project, allowing for tests to start with
 * a clean slate.
 */
function resetSandbox() {
  process.chdir(testWorkingDir);
  fs.ensureDirSync(sandboxRoot);
  try {
    fs.emptyDirSync(sandboxRoot);
  }
  catch (err) {
    console.log(err);
  }
  fs.copySync(projectRoot, sandboxRoot);
}

function getResetProject(options?:{readonly?:boolean}){
  resetSandbox();
  return new Gms2Project({projectPath:sandboxRoot,readOnly:options?.readonly});
}

// TESTS
describe("GMS2.3 Pipeline SDK", function () {

  beforeEach(function () {
    resetSandbox();
  });

  describe("Unit Tests", function () {

    it('can fetch a text URL', async function(){
      const page = await get('https://beta.bscotch.net/api/dummy/content-type/text');
      expect(page.contentType.startsWith('text/plain')).to.be.true;
      expect(page.data).to.equal('Hello World');
    });

    it('can fetch a binary URL', async function(){
      const page = await get('https://beta.bscotch.net/api/dummy/content-type/binary');
      expect(page.contentType.startsWith('application/octet-stream')).to.be.true;
      expect(Buffer.isBuffer(page.data)).to.be.true;
      expect(page.data.toString()).to.equal('Hello World');
    });

    it('can fetch a JSON URL', async function(){
      const page = await get('https://beta.bscotch.net/api/dummy/content-type/json');
      expect(page.contentType.startsWith('application/json')).to.be.true;
      expect(page.data.Hello).to.equal('World');
    });

    it('can download and unzip an archive', async function(){
      const dir = 'zip-download';
      const smallRepo = 'https://github.com/bscotch/node-util/archive/d1264e78319521c9667206330a9aaa36fa82e1a5.zip?ignore=this';
      const downloadedTo = await unzipRemote(smallRepo,dir);
      expect(downloadedTo).to.match(/node-util-d1264e78319521c9667206330a9aaa36fa82e1a5/);
      fs.emptyDirSync(dir);
      fs.removeSync(dir);
    });

    it('can create fixed-decimal numbers',function(){
      expect(`${Number(15.1234134)}`).to.equal('15.1234134');
      expect(`${new NumberFixed(15.1234134,1)}`).to.equal('15.1');
      expect(`${new NumberFixed(15.1234134,3)}`).to.equal('15.123');
    });

    it("can sort paths by specificity",function(){
      const pathList = [
        'hello/world',
        'hello',
        'h/another',
        'hello/world/goodbye'
      ];
      const expectedOrder = [
        'hello',
        'h/another',
        'hello/world',
        'hello/world/goodbye'
      ];
      pathList.sort(paths.pathSpecificitySort);
      expect(pathList).to.eql(expectedOrder);
    });

    it("can create GMS2-style JSON", function(){
      expect(stringify({
        hello:'world',
        parent:{child:['10','20']},
        array:[{name:'child1',field:true},{name:"child2"}]
      })).to.equal(undent`
        {
          "hello": "world",
          "parent": {
            "child": [
              "10",
              "20",
            ],
          },
          "array": [
            {"name":"child1","field":true,},
            {"name":"child2",},
          ],
        }
      `);
    });
  });

  describe("Gms2 Project Class", function () {

    it("can delete a resource", function(){
      const project = getResetProject({readonly:true});
      const name = project.resources.all[0].name;
      expect(project.resources.findByName(name)).to.exist;
      project.deleteResourceByName(name);
      expect(project.resources.findByName(name)).to.not.exist;
      expect(project.toJSON().resources.find(r=>r.id.name==name)).to.not.exist;
    });

    it('can delete an included file',function(){
      const project = getResetProject();
      const file = project.includedFiles.list()[0];
      expect(file,'file must exist to be deleted').to.exist;
      project.deleteIncludedFileByName(file.name);
      expect(project.includedFiles.find(f=>f.name==file.name),'file should not be in yyp').to.be.undefined;
      expect(fs.existsSync(file.filePathAbsolute),'file should not exist on disk').to.be.false;
    });

    it("can hydrate and dehydrate the YYP file, resulting in the original data",function(){
      const project = getResetProject({readonly:true});
      const rawContent = loadFromFileSync(project.yypAbsolutePath);
      const dehydrated = project.toJSON();
      // Note: Projects always ensure that "/NEW" (folder) exists,
      // so delete it before making sure we got back what we put in
      // (since it does not exist in the original)
      const newStuffFolderIdx = dehydrated.Folders.findIndex(f=>f.name=='NEW');
      expect(newStuffFolderIdx,'A /NEW folder should exist').to.be.greaterThan(-1);
      dehydrated.Folders.splice(newStuffFolderIdx,1);
      expect(dehydrated,
        "dehydrated content should match the original yyp file"
      ).to.eql(rawContent);
      const rawKeys = Object.keys(rawContent);
      rawKeys.sort();
      const dehydratedKeys = Object.keys(dehydrated);
      dehydratedKeys.sort();
      expect([1,2,3],'array deep equality check should require same order').to.not.eql([2,1,3]);
      expect(rawKeys,'dehydrated projects should have the same keys').to.eql(dehydratedKeys);
    });

    it("can create new folders", function(){
      const project = getResetProject();
      const newFolders = ["hello/world","deeply/nested/folder/structure"];
      for(const newFolder of newFolders ){
        project.addFolder(newFolder);
      }
      const projectFolders = project.toJSON().Folders;
      const allExpectedFolders = newFolders.map(f=>paths.heirarchy(f)).flat(3);
      expect(allExpectedFolders.length).to.equal(6);
      for(const expectedFolder of allExpectedFolders){
        const folderInProject = projectFolders.find(f=>f.folderPath==`folders/${expectedFolder}.yy`);
        expect(folderInProject,`Folder ${expectedFolder} should have been added`).to.exist;
      }
    });

    it('can add an object', function(){
      const project = getResetProject();
      const name = 'myRandomObject';
      let object = project.resources.findByField('name',name,Gms2Object);
      expect(object,'object should not exist before being added').to.not.exist;

      // Get a parent object and sprite to add later
      const sprite = project.resources.sprites[0];
      const parent = project.resources.objects[0];

      project.addObject(name);
      object = project.resources.findByField('name',name,Gms2Object);
      if(!object){
        throw new StitchError('object should have been added');
      }

      // Update the object's parent and sprite.
      object.spriteName = sprite.name;
      object.parentName = parent.name;
      expect(object.spriteName).to.equal(sprite.name);
      expect(object.parentName).to.equal(parent.name);
    });

    it('can create new scripts', function(){
      const project = getResetProject();
      const name = 'helloWorld';
      const code = 'function hello (world){ return world;}';
      project.addScript(name,code);
      const script = project.resources.findByField('name',name,Gms2Script);
      if(!script){
        throw new Error('script should have been added');
      }
      expect(script.code).to.equal(code);
    });

    it("can add a single sound asset",function(){
      const project = getResetProject();
      expect(()=>project.addSounds(soundSample+"fake_path"),
        'should not be able to upsert non-existing audio assets'
      ).to.throw();
      const invalidAudioSample = paths.join(soundSampleRoot, "sfx_badgeunlock_m4a.m4a");
      expect(()=>project.addSounds(invalidAudioSample),
        'should not be able to upsert audio assets with unsupported extensions.'
      ).to.throw();
      project.addSounds(soundSample);
      // Questions:
      //   Is the sound in the yyp?
      const audio = project.resources
        .findByField('name',paths.parse(soundSample).name,Gms2Sound);
      expect(audio,'New audio should be upserted').to.exist;
      if(!audio){ throwNever(); }
      //   Does the sound .yy exist?
      expect(fs.existsSync(audio.yyPathAbsolute),'.yy file should exist').to.be.true;
      //   Does the audio file exist?
      expect(fs.existsSync(audio.audioFilePathAbsolute),'audio file should exist').to.be.true;
    });

    it("can modify a single sound asset",function(){
      const project = getResetProject();
      project.addSounds(soundSample);
      const audio = project.resources
        .findByField('name',paths.parse(soundSample).name,Gms2Sound);
      if (!audio){
        throw new Error('audio should have been added');
      }
      //Changing channels
      audio.channels = "Mono";
      expect(audio?.channels).to.equal("Mono");
      expect(audio?.channelsAsIndex()).to.equal(SoundChannel.Mono);
      audio.channels = "Stereo";
      expect(audio?.channels).to.equal("Stereo");
      expect(audio?.channelsAsIndex()).to.equal(SoundChannel.Stereo);

      //Changing compressions
      audio.compression = "Compressed";
      expect(audio?.compression).to.equal("Compressed");
      expect(audio?.compressionAsIndex()).to.equal(SoundCompression.Compressed);
      audio.compression = "UncompressedOnLoad";
      expect(audio?.compression).to.equal("UncompressedOnLoad");
      expect(audio?.compressionAsIndex()).to.equal(SoundCompression.UncompressedOnLoad);
    });

    it("can batch add sound assets",function(){
      let project = getResetProject();
      expect(()=>project.addSounds(soundSampleRoot+'-fake.mp3'),
        'should not be able to batch add sounds from non-existing path'
      ).to.throw();
      const invalidAudioSample = paths.join(soundSampleRoot, "sfx_badgeunlock_m4a.m4a");
      const invalidAudioSampleExt = paths.extname(invalidAudioSample).slice(1);
      expect(()=>project.addSounds(soundSampleRoot, [invalidAudioSampleExt]),
        'should not be able to batch add sounds with unsupported extensions.'
      ).to.throw();
      project.addSounds(soundSampleRoot);
      const batchAudioSampleNames = ["sfx_badgeunlock_intro.ogg", "mus_intro_jingle.wav", "sfx_badgeunlock_mp3.mp3", "sfx_badgeunlock_wma.wma"];
      // Questions:
      //   Is the sound in the yyp?
      for (const batchAudioSampleName of batchAudioSampleNames){
        const audio = project.resources
          .findByField('name',paths.parse(batchAudioSampleName).name,Gms2Sound);
        expect(audio,'New audio should be upserted').to.exist;
        if(!audio){ throwNever(); }
        //   Does the sound .yy exist?
        expect(fs.existsSync(audio.yyPathAbsolute),'.yy file should exist').to.be.true;
        //   Does the audio file exist?
        expect(fs.existsSync(audio.audioFilePathAbsolute),'audio file should exist').to.be.true;
        const resourceName = audio.name;
        const expectedResourceProjectPath = paths.resolve(paths.join(sandboxRoot, "sounds", resourceName, `${resourceName}.yy`));
        expect(audio.yyPathAbsolute).to.equal(expectedResourceProjectPath);
      }

      project = getResetProject();
      const allowedExtensions = ["wav"];
      project.addSounds(soundSampleRoot, allowedExtensions);
      for (const batchAudioSampleName of batchAudioSampleNames){
        const extension = paths.extname(batchAudioSampleName).slice(1);
        const isAllowedExtension = allowedExtensions.includes(extension);
        const audio = project.resources
          .findByField('name',paths.parse(batchAudioSampleName).name,Gms2Sound);
        if (isAllowedExtension){
          expect(audio,'Allowed extension should be upserted').to.exist;
          if(!audio){ throwNever(); }
          expect(fs.existsSync(audio.yyPathAbsolute),'.yy file should exist').to.be.true;
          expect(fs.existsSync(audio.audioFilePathAbsolute),'audio file should exist').to.be.true;
        }
        else{
          expect(audio,'Non-allowed extensions should not be upserted').to.not.exist;
        }
      }
    });

    it("can create a new texture group",function(){
      const project = getResetProject();
      const newTextureGroupName = 'NewTextureGroup';
      // Create the texture group
      expect(project.textureGroups.findByField('name',newTextureGroupName),
        'the new texture group should not already exist'
      ).to.not.exist;
      project.addTextureGroup(newTextureGroupName);
      expect(project.textureGroups.findByField('name',newTextureGroupName),
        'the new texture group should be added'
      ).to.exist;
    });

    it("can create a new audio group",function(){
      const project = getResetProject();
      const newAudioGroupName = 'NewAudioGroup';
      // Create the texture group
      expect(project.audioGroups.findByField('name',newAudioGroupName),
        'the new audio group should not already exist'
      ).to.not.exist;
      project.addAudioGroup(newAudioGroupName);
      expect(project.audioGroups.findByField('name',newAudioGroupName),
        'the new audio group should be added'
      ).to.exist;
    });

    it("can create texture group assignments",function(){
      const project = getResetProject();
      const newTextureGroupName = 'NewTextureGroup';
      const sprite = project.resources.sprites[0];
      expect(sprite.textureGroup,
        'sprite should not be in target texture group'
      ).to.not.equal(newTextureGroupName);
      project.addTextureGroupAssignment(sprite.folder,newTextureGroupName);
      // The new Texture page should exist
      expect(project.textureGroups.findByField('name',newTextureGroupName),
        'the new texture group should be added'
      ).to.exist;
      // The Sprite should be properly reassigned
      expect(sprite.textureGroup,
        'sprite should be reassigned'
      ).to.equal(newTextureGroupName);
    });

    it("can create audio group assignments",function(){
      const project = getResetProject();
      const newAudioGroupName = 'NewAudioGroup';
      const sound = project.resources.sounds[0];
      expect(sound.audioGroup,
        'sound should not be in target audio group'
      ).to.not.equal(newAudioGroupName);
      project.addAudioGroupAssignment(sound.folder,newAudioGroupName);
      // The new Texture page should exist
      expect(project.audioGroups.findByField('name',newAudioGroupName),
        'the new audio group should be added'
      ).to.exist;
      // The Sprite should be properly reassigned
      expect(sound.audioGroup,
        'sound should be reassigned'
      ).to.equal(newAudioGroupName);
    });

    it("will fail if importing non-existent included file",function(){
      const project = new Gms2Project(sandboxRoot);
      // Attempt to add non-existent file
      expect(()=>project.addIncludedFiles(soundSample+'-fake.mp3'),
        'attempting to add a non-existent file should throw'
      ).to.throw();
    });

    it("can update existing included files on import",function(){
      const project = getResetProject();

      const filesDir = `${assetSampleRoot}/includedFiles`;

      // Add a file that already exists
      const existingFilePath = `shared/shared.txt`;
      const sharedFileSourceContent = 'This content should get copied over.';
      const sharedFile = project.includedFiles.findByField('name','shared.txt');
      if(!sharedFile){throw new StitchError(`shared file should exist`);}
      expect(sharedFile.contentAsBuffer,'shared file before copy should be empty').to.eql(Buffer.from([]));
      project.addIncludedFiles(`${filesDir}/${existingFilePath}`,{subdirectory:'shared'});
      expect(sharedFile.contentAsBuffer.toString()).to.eql(sharedFileSourceContent);
    });

    it("can import new included files", function(){
      const project = getResetProject();

      // Add all files from a directory
      const filesDir = `${assetSampleRoot}/includedFiles/files`;
      const subdir = 'BscotchPack';
      project.addIncludedFiles(filesDir,{subdirectory:subdir});
      const expectedFilePaths = fs.listFilesSync(filesDir, true);
      const expectedFileNames = expectedFilePaths
        .map(filePath=>paths.parse(filePath).base);
      for(const filePath of expectedFileNames){
        const fileResource = project.includedFiles.findByField('name',filePath);
        if (!fileResource){
          console.log('all imported files should exist in the project resource');
          throwNever();
        }
        const datafileDir = paths.join(sandboxRoot, fileResource.toJSON().filePath);
        expect(fs.existsSync(datafileDir),'all imported files should exist in the actual datafiles path').to.be.true;
      }
    });

    it("can import new included files by extensions", function(){
      const project = getResetProject();

      // Add all files from a directory
      const filesDir = `${assetSampleRoot}/includedFiles/files`;
      const allowedExtensions = ["json", "md"];
      project.addIncludedFiles(filesDir,{subdirectory:'BscotchPack',allowedExtensions});
      const availableFiles = fs.listFilesSync(filesDir)
        .map(filePath=>paths.parse(filePath).base);
      for(const filePath of availableFiles){
        const fileExtension = paths.extname(filePath).slice(1);
        const res = project.includedFiles.findByField('name',filePath);
        if (allowedExtensions.includes(fileExtension)){
          expect(res,'all imported files should exist').to.exist;
        }
        else{
          expect(res,'all imported files should exist').to.not.exist;
        }
      }
    });

    it("can add an IncludedFile using a data blob", function(){
      const project = getResetProject();

      const binaryExample = Buffer.from([1,2,3]);
      expect(project.addIncludedFiles('binary',{content:binaryExample})[0].contentAsBuffer).to.eql(binaryExample);

      const textExample = "hello";
      expect(project.addIncludedFiles('text',{content:textExample})[0].contentAsString).to.eql(textExample);

      const jsonExample = {hello:[1,2,3]};
      expect(project.addIncludedFiles('json',{content:jsonExample})[0].contentParsedAsJson).to.eql(jsonExample);
    });

    it("can import sprites", function(){
      const project = getResetProject();
      expect(project.resources.findByName('mySprite'),
        'sprite should not exist before being added'
      ).to.not.exist;
      project.addSprites(spriteSampleRoot,{case:'camel'});
      expect(project.resources.findByName('mySprite')).to.exist;
    });

    it("can import sprites while prefixing and flattening names",async function(){
      const project = getResetProject();
      expect(project.resources.findByName('mySprite'),
        'sprite should not exist before being added'
      ).to.not.exist;
      project.addSprites(spriteSampleRoot,{flatten:true,prefix:'sp_',case:'snake'});
      expect(project.resources.findByName('sp_this_is_my_sprite')).to.exist;
    });

    it("can import modules from one project into another", function(){
      const sourceProject = getResetProject({readonly:true});
      const modules = ["BscotchPack","AnotherModule"];

      // Initial state
      const project = new Gms2Project(sandboxProjectYYPPath);
      const resourcesToImport = sourceProject.resources.filter(resource=>{
        return modules.some(module=>resource.isInModule(module));
      }).map(resource=>resource.toJSON());
      expect(project.configs.findChild('BscotchPack'),
        'BscotchPack config should not exist before import'
      ).to.not.exist;

      // IMPORT
      project.importModules(modulesRoot,modules);

      // Check Resources
      const unexported = differenceBy(project.resources.toJSON(),resourcesToImport,'name');
      expect(unexported.length,'every module asset should have been imported').to.equal(0);

      // Check IncludedFiles
      expect(project.configs.findChild('BscotchPack'),
        'BscotchPack config should be imported'
      ).to.exist;
      const resourceData = project.includedFiles.findByField('name','moduleFile.txt');
      if(!resourceData){
        console.log('included file should be imported');
        throwNever();
      }
      const datafileDir = paths.join(sandboxRoot, resourceData.toJSON().filePath);
      expect(fs.existsSync(datafileDir), "The imported files should exist in the actual datafiles path");
    });

    it("can import *all* assets from a project",function(){
      // TODO: THIS IS JUST COPIED FROM PRIOR TEST
      // TODO: IMPORT EVERYTHING AND MAKE SURE IT APPEARS
      getResetProject({readonly:true});

      // Initial state
      const project = new Gms2Project(sandboxProjectYYPPath);
      project.importModules(modulesRoot);

      // Check IncludedFiles
      expect(project.configs.findChild('BscotchPack'),
        'BscotchPack config should be imported'
      ).to.exist;
      const resourceData = project.includedFiles.findByField('name','moduleFile.txt');
      if(!resourceData){
        console.log('included file should be imported');
        throwNever();
      }
      const datafileDir = paths.join(sandboxRoot, resourceData.toJSON().filePath);
      expect(fs.existsSync(datafileDir), "The imported files should exist in the actual datafiles path");
    });

    it("can set the version in options files",function(){
      const project = getResetProject();
      const testPlatforms = Gms2Project.platforms;
      const version = '100.5.6-rc.11';
      project.version = version;
      for(const platform of testPlatforms){
        expect(project.versionOnPlatform(platform), `${platform}'s version is not set.`).to.equal('100.5.6.11');
      }
      // Ensure version formats generally work (errors thrown if they don't)
      for(const validVersion of ['10.0.10','5.3.6.1','100.9.3-rc.3333']){
        project.version = validVersion;
      }
      // Test a handful of invalid formats
      for(const invalidVersion of ['10.0.10.9.9','.5.3.5','100.9.3-hotfix.3333','1.1.1.1-rc.1']){
        expect(()=>project.version = invalidVersion).to.throw();
      }
    });

  });

  describe("CLI",function(){

    it('cannot import modules missing dependencies',async function(){
      resetSandbox();
      const importModulesOptions = {
        source: modulesRoot,
        modules: ["MissingDependency"],
        targetProject: sandboxRoot
      };
      try{
        await importModules(importModulesOptions);
        throw new Error('Should fail when there is a missing dependency');
      }
      catch(err){
        if(! (err instanceof StitchAssertionError)){
          throw err;
        }
      }
      importModulesOptions.modules.push('BscotchPack');
      await importModules(importModulesOptions); // will throw if it fails
    });


    it('can import modules', async function(){
      resetSandbox();
      let incorrectImportModulesOtions = {
        source: "fake_source_project_path",
        modules: ["BscotchPack","AnotherModule"],
        targetProject: sandboxRoot
      };

      try{
        await importModules(incorrectImportModulesOtions);
        throw new Error('Should fail when source does not exists');
      }
      catch(err){
        if(! (err instanceof cli_assert.Gms2PipelineCliAssertionError)){
          throw err;
        }
      }

      incorrectImportModulesOtions = {
        source: modulesRoot,
        modules: ["BscotchPack","AnotherModule"],
        targetProject: "fake_target_project_path"
      };
      try{
        await importModules(incorrectImportModulesOtions);
        throw new Error('Should fail when targetProject is entered but does not exists');
      }
      catch(err){
        if(! (err instanceof cli_assert.Gms2PipelineCliAssertionError)){
          throw err;
        }
      }

      let importModulesOptions: ImportModuleOptions = {
        source: modulesRoot,
        modules: ["BscotchPack","AnotherModule"],
        targetProject: sandboxRoot
      };
      await importModules(importModulesOptions); // will throw if error

      resetSandbox();
      importModulesOptions = {
        source: modulesRoot,
        modules: ["BscotchPack"],
        targetProject: sandboxRoot
      };
      await importModules(importModulesOptions);
    });

    it('can import modules from a remote repo', async function(){
      resetSandbox();
      await importModules({
        doNotMoveConflicting:true,
        modules:['scripts'],
        sourceGithub:'gm-core/gdash@6.0.2',
        targetProject: sandboxRoot
      });
      const project = new Gms2Project({projectPath:sandboxRoot,readOnly:true});
      expect(project.resources.findByName('_reverse')).to.exist;
      expect(project.resources.findByName('preimport')).to.exist;
    });

    it('can import sounds',function(){
      resetSandbox();
      const invalidOptions = {
        source: soundSampleRoot,
        extensions: [""],
        targetProject: sandboxRoot
      };
      expect(()=>importSounds(invalidOptions), "Should fail when providing no valid extensions.").to.throw(cli_assert.Gms2PipelineCliAssertionError);

      const fileOptions = {
        source: soundSample,
        targetProject: sandboxRoot
      };
      expect(()=>importSounds(fileOptions), "Should succeed when source path points to a valid file").to.not.throw();

      resetSandbox();
      const folderOptions = {
        source: soundSampleRoot,
        targetProject: sandboxRoot
      };
      expect(()=>importSounds(folderOptions), "Should succeed when source path points to a valid folder").to.not.throw();

      resetSandbox();
      const filteredOptions = {
        source: soundSampleRoot,
        extensions: ["wav"],
        targetProject: sandboxRoot
      };
      expect(()=>importSounds(filteredOptions), "Should succeed when source path points to a valid folder and importing only a subset of extensions.").to.not.throw();
    });

    it('can import files', function(){
      resetSandbox();
      const options = {
        source: paths.join(assetSampleRoot, "includedFiles", "files"),
        targetProject: sandboxRoot
      };
      expect(()=>importFiles(options), "Should succeed when source path points to a valid folder").to.not.throw();
    });

    it('can set the project version', function(){
      const project = getResetProject();
      const versionOptions: VersionOptions = {
        projectVersion: "100.5.6-rc.11",
        targetProject: sandboxRoot
      };
      expect(()=>version(versionOptions), "Should succeed when version is valid").to.not.throw();
      expect(project.versionOnPlatform("windows")).to.equal('100.5.6.11');
    });

    it('can assign texture groups', function(){
      let project = getResetProject();
      let sprite = project.resources.sprites[0];
      const newTextureGroupName = 'NewTextureGroup';
      const assignTextureOptions: AssignCliOptions = {
        folder: sprite.folder,
        groupName: newTextureGroupName,
        targetProject: sandboxRoot
      };
      expect(()=>assignTextureGroups(assignTextureOptions), "Should succeed when the arguments are correct").to.not.throw();

      project = new Gms2Project(sandboxProjectYYPPath);
      sprite = project.resources.sprites[0];
      // The new Texture page should exist
      expect(project.textureGroups.findByField('name',newTextureGroupName),
        'the new texture group should be added'
      ).to.exist;
      // The Sprite should be properly reassigned
      expect(sprite.textureGroup,
        'sprite should be reassigned'
      ).to.equal(newTextureGroupName);
    });

    it('can assign audio groups', function(){
      let project = getResetProject();
      let sound = project.resources.sounds[0];
      const newAudioGroupName = "NewAudioGroup";
      const assignAudioOptions: AssignCliOptions = {
        folder: sound.folder,
        groupName: newAudioGroupName,
        targetProject: sandboxRoot
      };
      expect(sound.audioGroup,
        'sound should not be in target audio group'
      ).to.not.equal(newAudioGroupName);
      expect(()=>assignAudioGroups(assignAudioOptions), "Should succeed when the arguments are correct").to.not.throw();

      project = new Gms2Project(sandboxProjectYYPPath);
      sound = project.resources.sounds[0];
      expect(project.audioGroups.findByField('name',newAudioGroupName),
        'the new audio group should be added'
      ).to.exist;
      // The Sprite should be properly reassigned
      expect(sound.audioGroup,
        'sound should be reassigned'
      ).to.equal(newAudioGroupName);
    });
  });

  after(function () {
    // new Project(sandboxProjectYYPPath);
    resetSandbox();
  });
});
