import { expect } from 'chai';
// import { Project} from '../project/Project';
import fs from '../lib/files';
import paths from '../lib/paths';
// import projectDiff from '../project/projectDiff';
// import { inspect } from 'util';
import { Gms2Project } from '../lib/Gms2Project';
// import audioImport from "../cli/lib/audio-import";
// import {execSync} from  "child_process";
// import {Resource} from "../project/resources/Resource";
// import { Sprite } from '../project/resources/Sprite';
import {loadFromFileSync} from "../lib/json";
import { undent, oneline } from "../lib/strings";
import { Gms2Sound } from '../lib/components/resources/Gms2Sound';
import { differenceBy, fromPairs } from 'lodash';
import { Gms2PipelineError } from '../lib/errors';

// const deeplog = (obj: any) => {
//   console.log(inspect(obj, false, null));
// };

const sandboxRoot = './sand box/'; // Use a space to ensure nothing bad happens.
const projectRoot = './sample-project/';
const projectYYP = 'sample-project.yyp';
const modulesRoot = "./sample-module-source/";
// const sourceProjectYYPPath = paths.join(projectRoot, projectYYP);
const sandboxProjectYYPPath = paths.join(sandboxRoot, projectYYP);
const assetSampleRoot = './sample-assets/';
const soundSampleRoot = `${assetSampleRoot}sounds/`;
const audioSample = `${soundSampleRoot}mus_intro_jingle.wav`;

function throwNever():never{
  throw new Error("this should never happen");
}

function resetSandbox() {
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

    it("can add sounds",function(){
      const project = getResetProject();
      expect(()=>project.addSound(audioSample+'-fake.mp3'),
        'should not be able to upsert non-existing audio assets'
      ).to.throw;
      project.addSound(audioSample);
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
      expect(()=>project.addIncludedFile(audioSample+'-fake.mp3'),
        'attempting to add a non-existent file should throw'
      ).to.throw;
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
      project.addIncludedFile(`${filesDir}/${existingFilePath}`,null,'shared');
      expect(sharedFile.contentAsBuffer.toString()).to.eql(sharedFileSourceContent);

    });

    it("can import new included files", function(){
      const project = getResetProject();

      // Add all files from a directory
      const filesDir = `${assetSampleRoot}/includedFiles/files`;
      project.addIncludedFile(filesDir,null,'BscotchPack');
      const expectedFiles = fs.listFilesSync(filesDir)
        .map(filePath=>paths.parse(filePath).base);
      for(const filePath of expectedFiles){
        expect(project.includedFiles.findByField('name',filePath),'all imported files should exist').to.exist;
      }
    });

    it("can add an IncludedFile using a data blob", function(){
      const project = getResetProject();

      const binaryExample = Buffer.from([1,2,3]);
      expect(project.addIncludedFile('binary',binaryExample)[0].contentAsBuffer).to.eql(binaryExample);

      const textExample = "hello";
      expect(project.addIncludedFile('text',textExample)[0].contentAsString).to.eql(textExample);

      const jsonExample = {hello:[1,2,3]};
      expect(project.addIncludedFile('json',jsonExample)[0].contentParsedAsJson).to.eql(jsonExample);
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
    });


    // xdescribe("gms-tools CLIs",function(){
    //   it('fails when it should',function(){
    //     // Arguments are required
    //     expect(()=>audioImport('','')).to.throw;
    //     // Will not try to import an invalid file
    //     expect(()=>audioImport(sandboxProjectYYPPath,audioSample + 'fake-ext.wav')).to.throw;
    //     // Will fail if hitting a folder without any sound files
    //     expect(()=>audioImport(sandboxProjectYYPPath,`${sandboxRoot}views`)).to.throw;
    //     // Will fail if project path is invalid
    //     expect(()=>audioImport(sandboxProjectYYPPath+'fake-ext.meh',audioSample)).to.throw;
    //     expect(()=>audioImport('./project.json',audioSample)).to.throw;
    //   });
    //   it('can import single audio files',function(){
    //     resetSandbox();
    //     audioImport(sandboxProjectYYPPath,audioSample);
    //     const changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
    //     expect(changes.length).to.be.greaterThan(0);
    //   });
    //   it('can import single audio files',function(){
    //     resetSandbox();
    //     audioImport(sandboxProjectYYPPath,soundSampleRoot);
    //     const changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
    //     expect(changes.length).to.be.greaterThan(0);
    //   });
    //   it('can run from the CLI',function(){
    //     // Depending on whether running with node or ts-node, need different route
    //     let cliPath = paths.join(__dirname,'..','cli','gms2-tools-audio.js');
    //     if(__filename.endsWith('.ts')){
    //       cliPath = paths.join(__dirname,'..','..','build','cli','gms2-tools-audio.js');
    //     }
    //     const args = `node "${cliPath}" -p "${sandboxProjectYYPPath}" -s "${soundSampleRoot}"`;
    //     const res = execSync(args);
    //     console.log(res.toString());
    //   });
    //   it('can add a folder and texture to the "Textures" of the config file', function(){
    //     resetSandbox();
    //     const project = new Project(sandboxProjectYYPPath);
    //     const folder  = "Sprites/testGroup";
    //     const subfolder = "Sprites/testGroup/testSubGroup";
    //     const texture = "TestTexture";
    //     const subTexture = "OtherTestTexture";
    //     const topLevelTextureID = project.getTextureByName(texture)?.id;
    //     const subTextureID = project.getTextureByName(subTexture)?.id;

    //     expect(topLevelTextureID).to.be.a("string");
    //     const thisView      = project.getViewByPath(folder);
    //     expect(thisView).to.exist;
    //     const spritesInViewRecursive = thisView.getChildren("GMSprite", true) as Sprite[];
    //     expect(spritesInViewRecursive.length, "Should have found two sprites.").to.equal(2);
    //     for (const sprite of spritesInViewRecursive) {
    //       expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID is not set to default.").to.not.equal(topLevelTextureID);
    //     }
    //     expect(function(){
    //       project.addFolderToTextureGroup("wrongFolder", "wrongTexture");
    //     }, "Should fail if wrong texture and folder.").to.throw;
    //     expect(function(){
    //       project.addFolderToTextureGroup(folder, "wrongTexture");
    //     }, "Should fail if wrong texture.").to.throw;
    //     expect(function(){
    //       project.addFolderToTextureGroup("wrongFolder", texture);
    //     }, "Should fail if wrong folder.").to.throw;
    //     project.addFolderToTextureGroup(folder, texture);
    //     for (const sprite of spritesInViewRecursive) {
    //       expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(topLevelTextureID);
    //     }
    //     project.removeFolderFromTextureGroups(folder);
    //     project.addFolderToTextureGroup(subfolder, subTexture);
    //     project.addFolderToTextureGroup(folder, texture);
    //     const spritesInParentView = thisView.getChildren("GMSprite", false) as Sprite[];
    //     const spritesInSubView    = project.getViewByPath(subfolder).getChildren("GMSprite", true) as Sprite[];
    //     expect(spritesInParentView.length).to.be.greaterThan(0);
    //     expect(spritesInSubView.length).to.be.greaterThan(0);
    //     for (const sprite of spritesInParentView) {
    //       expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(topLevelTextureID);
    //     }
    //     for (const sprite of spritesInSubView) {
    //       expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(subTextureID);
    //     }
    //   });
  });

  after(function () {
    // new Project(sandboxProjectYYPPath);
    resetSandbox();
  });
});
