import { expect } from 'chai';
import fs from '../lib/files';
import fs_extra from "fs-extra";
import paths from '../lib/paths';
import { Gms2Project } from '../lib/Gms2Project';
import {loadFromFileSync} from "../lib/json";
import { undent, oneline } from "../lib/strings";
import { Gms2Sound } from '../lib/components/resources/Gms2Sound';
import { differenceBy } from 'lodash';
import { Gms2PipelineError } from '../lib/errors';
import { Gms2Script } from '../lib/components/resources/Gms2Script';
import jsonify, { JsonifyOptions } from '../cli/lib/jsonify';
import cli_assert from '../cli/lib/cli-assert';
import importModules, { ImportModuleOptions } from '../cli/lib/import-modules';
import importSounds from '../cli/lib/import-sounds';
import { ImportBaseOptions } from '../cli/lib/import-base-options';

process.env.GMS2PDK_DEV = 'true';

// const deeplog = (obj: any) => {
//   console.log(inspect(obj, false, null));
// };

const sandboxRoot = ('./sand box/'); // Use a space to ensure nothing bad happens.
const projectRoot = ('./sample-project/');
const projectYYP = 'sample-project.yyp';
const modulesRoot = ("./sample-module-source/");
// const sourceProjectYYPPath = paths.join(projectRoot, projectYYP);
const sandboxProjectYYPPath = paths.join(sandboxRoot, projectYYP);
const assetSampleRoot = ('./sample-assets/');
const soundSampleRoot = paths.join(assetSampleRoot, "sounds");
const audioSample = paths.join(soundSampleRoot,"mus_intro_jingle.wav");
const invalidAudioSample = paths.join(soundSampleRoot, "sfx_badgeunlock_m4a.m4a");
const invalidAudioSampleExt = paths.extname(invalidAudioSample).slice(1);
const batchAudioSampleNames = ["sfx_badgeunlock_intro.ogg", "mus_intro_jingle.wav", "sfx_badgeunlock_mp3.mp3", "sfx_badgeunlock_wma.wma"];
const testWorkingDir = process.cwd();

function throwNever():never{
  throw new Error("this should never happen");
}

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

function getResetProject(readOnly=false){
  resetSandbox();
  return new Gms2Project({projectPath:sandboxRoot,readOnly});
}

describe("GMS2.3 Pipeline SDK", function () {

  beforeEach(function () {
    resetSandbox();
  });

  describe("Unit Tests", function () {

    it("can dedent string literals", function () {
      const interp1 = 'hello';
      const interp2 = 'goodbye';
      const dedented = undent`
        Here is a:
          multine string ${interp1}
          look
      at it goooo ${interp2}
              weeee!
      
      `;
      const expected = `  Here is a:
    multine string ${interp1}
    look
at it goooo ${interp2}
        weeee!`;
      expect(expected).to.equal(dedented);
    });

    it("can oneline string literals", function () {
      const interp1 = 'hello';
      const interp2 = 'goodbye';
      const onelined = oneline`
        Here is a:
          multine string ${interp1}
          look
      at it goooo ${interp2}
              weeee!
      
      `;
      const expected = `Here is a: multine string ${interp1} look at it goooo ${interp2} weeee!`;
      expect(expected).to.equal(onelined);
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
  });

  describe("Gms2 Project Class", function () {

    it("can delete a resource", function(){
      const project = getResetProject(true);
      const name = project.resources.all[0].name;
      expect(project.resources.findByName(name)).to.exist;
      project.deleteResourceByName(name);
      expect(project.resources.findByName(name)).to.not.exist;
      expect(project.dehydrated.resources.find(r=>r.id.name==name)).to.not.exist;
    });

    it("can hydrate and dehydrate the YYP file, resulting in the original data",function(){
      const project = getResetProject(true);
      const rawContent = loadFromFileSync(project.yypAbsolutePath);
      const dehydrated = project.dehydrated;
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
      const dehydratedKeys = Object.keys(dehydrated);
      expect([1,2,3],'array deep equality check should require same order').to.not.eql([2,1,3]);
      expect(rawKeys,'dehydrated projects should have keys in the same order').to.eql(dehydratedKeys);
    });

    it("can create new folders", function(){
      const project = getResetProject();
      const newFolders = ["hello/world","deeply/nested/folder/structure"];
      for(const newFolder of newFolders ){
        project.addFolder(newFolder);
      }
      const projectFolders = project.dehydrated.Folders;
      const allExpectedFolders = newFolders.map(f=>paths.heirarchy(f)).flat(3);
      expect(allExpectedFolders.length).to.equal(6);
      for(const expectedFolder of allExpectedFolders){
        const folderInProject = projectFolders.find(f=>f.folderPath==`folders/${expectedFolder}.yy`);
        expect(folderInProject,`Folder ${expectedFolder} should have been added`).to.exist;
      }
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
      expect(()=>project.addSounds(audioSample+"fake_path"),
        'should not be able to upsert non-existing audio assets'
      ).to.throw();
      expect(()=>project.addSounds(invalidAudioSample),
        'should not be able to upsert audio assets with unsupported extensions.'
      ).to.throw();
      project.addSounds(audioSample);
      // Questions:
      //   Is the sound in the yyp?
      const audio = project.resources
        .findByField('name',paths.parse(audioSample).name,Gms2Sound);
      expect(audio,'New audio should be upserted').to.exist;
      if(!audio){ throwNever(); }
      //   Does the sound .yy exist?
      expect(fs.existsSync(audio.yyPathAbsolute),'.yy file should exist').to.be.true;
      //   Does the audio file exist?
      expect(fs.existsSync(audio.audioFilePathAbsolute),'audio file should exist').to.be.true;
    });

    it("can batch add sound assets",function(){
      let project = getResetProject();
      expect(()=>project.addSounds(soundSampleRoot+'-fake.mp3'),
        'should not be able to batch add sounds from non-existing path'
      ).to.throw();
      expect(()=>project.addSounds(soundSampleRoot, [invalidAudioSampleExt]),
        'should not be able to batch add sounds with unsupported extensions.'
      ).to.throw();
      project.addSounds(soundSampleRoot);
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
      expect(()=>project.addIncludedFiles(audioSample+'-fake.mp3'),
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
      if(!sharedFile){throw new Gms2PipelineError(`shared file should exist`);}
      expect(sharedFile.contentAsBuffer,'shared file before copy should be empty').to.eql(Buffer.from([]));
      project.addIncludedFiles(`${filesDir}/${existingFilePath}`,null,'shared');
      expect(sharedFile.contentAsBuffer.toString()).to.eql(sharedFileSourceContent);

    });

    it("can import new included files", function(){
      const project = getResetProject();

      // Add all files from a directory
      const filesDir = `${assetSampleRoot}/includedFiles/files`;
      project.addIncludedFiles(filesDir,null,'BscotchPack');
      const expectedFiles = fs.listFilesSync(filesDir)
        .map(filePath=>paths.parse(filePath).base);
      for(const filePath of expectedFiles){
        expect(project.includedFiles.findByField('name',filePath),'all imported files should exist').to.exist;
      }
    });

    it.only("can import new included files by extensions", function(){
      const project = getResetProject();

      // Add all files from a directory
      const filesDir = `${assetSampleRoot}/includedFiles/files`;
      const allowedExtensions = ["json", "md"];
      project.addIncludedFiles(filesDir,null,'BscotchPack',allowedExtensions);
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
      expect(project.addIncludedFiles('binary',binaryExample)[0].contentAsBuffer).to.eql(binaryExample);

      const textExample = "hello";
      expect(project.addIncludedFiles('text',textExample)[0].contentAsString).to.eql(textExample);

      const jsonExample = {hello:[1,2,3]};
      expect(project.addIncludedFiles('json',jsonExample)[0].contentParsedAsJson).to.eql(jsonExample);
    });

    it("can import modules from one project into another", function(){
      const sourceProject = getResetProject(true);
      const modules = ["BscotchPack","AnotherModule"];

      // Initial state
      const project = new Gms2Project(sandboxProjectYYPPath);
      const resourcesToImport = sourceProject.resources.filter(resource=>{
        return modules.some(module=>resource.isInModule(module));
      }).map(resource=>resource.dehydrated);
      expect(project.configs.findChild('BscotchPack'),
        'BscotchPack config should not exist before import'
      ).to.not.exist;

      // IMPORT
      project.importModules(modulesRoot,modules);

      // Check Resources
      const unexported = differenceBy(project.resources.dehydrated,resourcesToImport,'name');
      expect(unexported.length,'every module asset should have been imported').to.equal(0);

      // Check IncludedFiles
      expect(project.configs.findChild('BscotchPack'),
        'BscotchPack config should be imported'
      ).to.exist;
      expect(project.includedFiles.findByField('name','moduleFile.txt'),
        'included file should be imported'
      ).to.exist;
    });

    it("can set the version in options files",function(){
      const project = getResetProject();
      const testPlatforms = ['windows','android'] as const;
      const version = '100.5.6-rc.11';
      project.version = version;
      for(const platform of testPlatforms){
        expect(project.versionOnPlatform(platform)).to.equal('100.5.6.11');
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

    it('Can jsonify a single yyp file', function(){
      expect(()=>fs_extra.readJsonSync(sandboxProjectYYPPath), "Original yyp file shoud not be parsable as json.").to.throw();
      const originalContent = fs.readJsonSync(sandboxProjectYYPPath);
      fs.convertGms2FilesToJson(sandboxProjectYYPPath);
      expect(()=>fs_extra.readJsonSync(sandboxProjectYYPPath), "Jsonified yyp file should be parsable as json.").to.not.throw();
      const jsonifiedContent = fs.readJsonSync(sandboxProjectYYPPath);
      expect(originalContent, "Jsonification should not change the content.").to.eql(jsonifiedContent);
    });

    it('Can batch jsonify yy(p) files in a directory', function(){
      const gms2Files = fs.listFilesByExtensionSync(sandboxRoot, [".yy", ".yyp"]);
      for (const gms2File of gms2Files){
        expect(()=>fs_extra.readJsonSync(gms2File), "Original yy(p) file shoud not be parsable as json.").to.throw();
      }

      fs.convertGms2FilesToJson(sandboxRoot);
      for (const gms2File of gms2Files){
        expect(()=>fs_extra.readJsonSync(gms2File), "Jsonified yyp file should be parsable as json.").to.not.throw();
      }
    });
  });

  describe("Gamemaker Studio 2: Pipeline Development Kit CLI",function(){
    it('Jsonify command',function(){
      let jsonifyOptions: JsonifyOptions = {
        path: sandboxProjectYYPPath
      };
      expect(()=>jsonify(jsonifyOptions), "Should succeed when processing just a file input.").to.not.throw();
      jsonifyOptions = {
        path: sandboxRoot
      };
      expect(()=>jsonify(jsonifyOptions), "Should succeed when processing just a directory input.").to.not.throw();

      process.chdir(sandboxRoot);
      jsonifyOptions = {
        path: "."
      };
      expect(()=>jsonify(jsonifyOptions), "Should succeed when using '.' to point to the cwd").to.not.throw();

      jsonifyOptions = {path: ""};
      expect(()=>jsonify(jsonifyOptions), "Should fail when there is no input.").to.throw(cli_assert.Gms2PipelineCliAssertionError);
    });


    it('Import Modules command', function(){
      let incorrectImportModulesOtions: ImportModuleOptions = {
        sourceProjectPath: "fake_source_project_path",
        modules: ["BscotchPack","AnotherModule"],
        targetProjectPath: sandboxRoot
      };
      expect(()=>importModules(incorrectImportModulesOtions), "Should fail when sourceProjectPath does not exists").to.throw(cli_assert.Gms2PipelineCliAssertionError);

      incorrectImportModulesOtions = {
        sourceProjectPath: modulesRoot,
        modules: [""],
        targetProjectPath: sandboxRoot
      };
      expect(()=>importModules(incorrectImportModulesOtions), "Should fail when there is no valid module inputs").to.throw(cli_assert.Gms2PipelineCliAssertionError);

      incorrectImportModulesOtions = {
        sourceProjectPath: modulesRoot,
        modules: ["BscotchPack","AnotherModule"],
        targetProjectPath: "fake_target_project_path"
      };
      expect(()=>importModules(incorrectImportModulesOtions), "Should fail when targetProjectPath is entered but does not exists").to.throw(cli_assert.Gms2PipelineCliAssertionError);

      let importModulesOptions: ImportModuleOptions = {
        sourceProjectPath: modulesRoot,
        modules: ["BscotchPack","AnotherModule"],
        targetProjectPath: sandboxRoot
      };
      expect(()=>importModules(importModulesOptions), "Should succeed when run with valid source path and multiple modules").to.not.throw();

      resetSandbox();
      importModulesOptions = {
        sourceProjectPath: modulesRoot,
        modules: ["BscotchPack"],
        targetProjectPath: sandboxRoot
      };
      expect(()=>importModules(importModulesOptions), "Should succeed when run with valid source path and 1 module").to.not.throw();
    });

    it('Import Sounds command',function(){
      const incorrectImportBaseOptions: ImportBaseOptions = {
        sourcePath: soundSampleRoot,
        allowExtensions: [""],
        targetProjectPath: sandboxRoot
      };
      expect(()=>importSounds(incorrectImportBaseOptions), "Should fail when providing no valid extensions.").to.throw(cli_assert.Gms2PipelineCliAssertionError);

      let ImportBaseOptions: ImportBaseOptions = {
        sourcePath: audioSample,
        targetProjectPath: sandboxRoot
      };
      expect(()=>importSounds(ImportBaseOptions), "Should succeed when source path points to a valid file").to.not.throw();

      resetSandbox();
      ImportBaseOptions = {
        sourcePath: soundSampleRoot,
        targetProjectPath: sandboxRoot
      };
      expect(()=>importSounds(ImportBaseOptions), "Should succeed when source path points to a valid folder").to.not.throw();

      resetSandbox();
      ImportBaseOptions = {
        sourcePath: soundSampleRoot,
        allowExtensions: ["wav"],
        targetProjectPath: sandboxRoot
      };
      expect(()=>importSounds(ImportBaseOptions), "Should succeed when source path points to a valid folder and importing only a subset of extensions.").to.not.throw();
    });





    // it('can add a folder and texture to the "Textures" of the config file', function(){
    //   resetSandbox();
    //   const project = new Project(sandboxProjectYYPPath);
    //   const folder  = "Sprites/testGroup";
    //   const subfolder = "Sprites/testGroup/testSubGroup";
    //   const texture = "TestTexture";
    //   const subTexture = "OtherTestTexture";
    //   const topLevelTextureID = project.getTextureByName(texture)?.id;
    //   const subTextureID = project.getTextureByName(subTexture)?.id;

    //   expect(topLevelTextureID).to.be.a("string");
    //   const thisView      = project.getViewByPath(folder);
    //   expect(thisView).to.exist;
    //   const spritesInViewRecursive = thisView.getChildren("GMSprite", true) as Sprite[];
    //   expect(spritesInViewRecursive.length, "Should have found two sprites.").to.equal(2);
    //   for (const sprite of spritesInViewRecursive) {
    //     expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID is not set to default.").to.not.equal(topLevelTextureID);
    //   }
    //   expect(function(){
    //     project.addFolderToTextureGroup("wrongFolder", "wrongTexture");
    //   }, "Should fail if wrong texture and folder.").to.throw;
    //   expect(function(){
    //     project.addFolderToTextureGroup(folder, "wrongTexture");
    //   }, "Should fail if wrong texture.").to.throw;
    //   expect(function(){
    //     project.addFolderToTextureGroup("wrongFolder", texture);
    //   }, "Should fail if wrong folder.").to.throw;
    //   project.addFolderToTextureGroup(folder, texture);
    //   for (const sprite of spritesInViewRecursive) {
    //     expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(topLevelTextureID);
    //   }
    //   project.removeFolderFromTextureGroups(folder);
    //   project.addFolderToTextureGroup(subfolder, subTexture);
    //   project.addFolderToTextureGroup(folder, texture);
    //   const spritesInParentView = thisView.getChildren("GMSprite", false) as Sprite[];
    //   const spritesInSubView    = project.getViewByPath(subfolder).getChildren("GMSprite", true) as Sprite[];
    //   expect(spritesInParentView.length).to.be.greaterThan(0);
    //   expect(spritesInSubView.length).to.be.greaterThan(0);
    //   for (const sprite of spritesInParentView) {
    //     expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(topLevelTextureID);
    //   }
    //   for (const sprite of spritesInSubView) {
    //     expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(subTextureID);
    //   }
    // });
  });

  after(function () {
    // new Project(sandboxProjectYYPPath);
    resetSandbox();
  });
});
