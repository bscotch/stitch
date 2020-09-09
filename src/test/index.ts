import { expect } from 'chai';
import { Project} from '../project/Project';
import { ensureDirSync, emptyDirSync, copySync } from 'fs-extra';
import { join } from 'path';
import projectDiff from '../project/projectDiff';
import { inspect } from 'util';
import audioImport from "../cli/lib/audio-import";
import {execSync} from  "child_process";
import {Resource} from "../project/resources/Resource";
import { Sprite } from '../project/resources/Sprite';
import json from "../project/lib/json";

const deeplog = (obj:any)=>{
  console.log(inspect(obj,false,null));
};

const sandboxRoot = './sand box/'; // Use a space to ensure nothing bad happens.
const projectRoot = './sample-project/';
const projectYYP = 'sample-project.yyp';
const modulesRoot = "./sample-module-source/";
const sourceProjectYYPPath = join(projectRoot,projectYYP);
const sandboxProjectYYPPath = join(sandboxRoot,projectYYP);
const assetSampleRoot = './sample-assets/';
const soundSampleRoot = `${assetSampleRoot}sounds/`;
const audioSample = `${soundSampleRoot}mus_intro_jingle.wav`;

function resetSandbox(): void{
  ensureDirSync(sandboxRoot);
  emptyDirSync(sandboxRoot);
  copySync(projectRoot,sandboxRoot);
}

describe("GMS2.3 Pipeline SDK", function(){

  beforeEach(function(){
    resetSandbox();
  });

  describe("Project Classes",function(){
    resetSandbox();
    let project = new Project(sandboxRoot);

    it("written content is unchanged", function(){
      const originalFile = json.readFileSync(project.absolutePath);
      project.commit();
      const writtenFile = json.readFileSync(project.absolutePath);
      expect(json.stringify(originalFile) == json.stringify(writtenFile)).to.be.true;
    });
    xit("can upsert folders",function(){
      resetSandbox();
      project = new Project(sandboxRoot);
      expect(()=>project.ensureViewExists('bleh/new/secondLevel')).to.throw;
      project.ensureViewExists('sounds/new/secondLevel/thirdLevel');
      const changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      expect(changes.length).to.be.greaterThan(0);
    });
    xit("can add sounds",function(){
      resetSandbox();
      project = new Project(sandboxRoot);
      expect(()=>project.upsertAudio(audioSample+'-fake.mp3')).to.throw;
      project.upsertAudio(audioSample);
      const changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      expect(changes.length).to.be.greaterThan(0);
    });
    xit("can add included files",function(){
      // Can include any type of file, so use the sound file for convenience
      resetSandbox();
      let changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      project = new Project(sandboxRoot);
      expect(()=>project.upsertIncludedFile(audioSample+'-fake.mp3')).to.throw;
      project.upsertIncludedFile(audioSample);
      changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      expect(changes.length).to.be.greaterThan(0);
      project.upsertIncludedFile('./README.md','sub/dir');
      changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      expect(changes.length).to.be.greaterThan(0);
    });
    xit("can accurately report view project heirarchy.", function() {
      resetSandbox();
      project = new Project(sandboxProjectYYPPath);
      const testSprite = project.resources.find(function(thisResource){
        return thisResource.name == "new_sprite" && thisResource.type == "GMSprite";
      });
      expect(testSprite).to.exist;
      expect((testSprite as Resource).projectHeirarchyPath).to.equal("sprites/testGroup/testSubGroup/new_sprite");
    });
    xit("can parse texture groups from the project directory", function(){
      resetSandbox();
      project = new Project(sandboxProjectYYPPath);
      const theseTextures = project.textureGroups;
      expect(theseTextures.length).to.be.greaterThan(0);
      const texture = theseTextures.find(function(texture) { return texture.name == "TestTexture";});
      expect(texture).to.exist;
    });
  });

  xdescribe("Modules", function(){
    it("can import modules from one project into another", function(){
      resetSandbox();
      const project = new Project(sandboxProjectYYPPath);
      project.importModules(modulesRoot,["BscotchPack","AnotherModule"]);
    });
  });

  xdescribe("gms-tools CLIs",function(){
    it('fails when it should',function(){
      // Arguments are required
      expect(()=>audioImport('','')).to.throw;
      // Will not try to import an invalid file
      expect(()=>audioImport(sandboxProjectYYPPath,audioSample + 'fake-ext.wav')).to.throw;
      // Will fail if hitting a folder without any sound files
      expect(()=>audioImport(sandboxProjectYYPPath,`${sandboxRoot}views`)).to.throw;
      // Will fail if project path is invalid
      expect(()=>audioImport(sandboxProjectYYPPath+'fake-ext.meh',audioSample)).to.throw;
      expect(()=>audioImport('./project.json',audioSample)).to.throw;
    });
    it('can import single audio files',function(){
      resetSandbox();
      audioImport(sandboxProjectYYPPath,audioSample);
      const changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      expect(changes.length).to.be.greaterThan(0);
    });
    it('can import single audio files',function(){
      resetSandbox();
      audioImport(sandboxProjectYYPPath,soundSampleRoot);
      const changes = projectDiff(sourceProjectYYPPath,sandboxProjectYYPPath);
      expect(changes.length).to.be.greaterThan(0);
    });
    it('can run from the CLI',function(){
      // Depending on whether running with node or ts-node, need different route
      let cliPath = join(__dirname,'..','cli','gms2-tools-audio.js');
      if(__filename.endsWith('.ts')){
        cliPath = join(__dirname,'..','..','build','cli','gms2-tools-audio.js');
      }
      const args = `node "${cliPath}" -p "${sandboxProjectYYPPath}" -s "${soundSampleRoot}"`;
      const res = execSync(args);
      console.log(res.toString());
    });
    it('can add a folder and texture to the "Textures" of the config file', function(){
      resetSandbox();
      const project = new Project(sandboxProjectYYPPath);
      const folder  = "Sprites/testGroup";
      const subfolder = "Sprites/testGroup/testSubGroup";
      const texture = "TestTexture";
      const subTexture = "OtherTestTexture";
      const topLevelTextureID = project.getTextureByName(texture)?.id;
      const subTextureID = project.getTextureByName(subTexture)?.id;

      expect(topLevelTextureID).to.be.a("string");
      const thisView      = project.getViewByPath(folder);
      expect(thisView).to.exist;
      const spritesInViewRecursive = thisView.getChildren("GMSprite", true) as Sprite[];
      expect(spritesInViewRecursive.length, "Should have found two sprites.").to.equal(2);
      for (const sprite of spritesInViewRecursive) {
        expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID is not set to default.").to.not.equal(topLevelTextureID);
      }
      expect(function(){
        project.addFolderToTextureGroup("wrongFolder", "wrongTexture");
      }, "Should fail if wrong texture and folder.").to.throw;
      expect(function(){
        project.addFolderToTextureGroup(folder, "wrongTexture");
      }, "Should fail if wrong texture.").to.throw;
      expect(function(){
        project.addFolderToTextureGroup("wrongFolder", texture);
      }, "Should fail if wrong folder.").to.throw;
      project.addFolderToTextureGroup(folder, texture);
      for (const sprite of spritesInViewRecursive) {
        expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(topLevelTextureID);
      }
      project.removeFolderFromTextureGroups(folder);
      project.addFolderToTextureGroup(subfolder, subTexture);
      project.addFolderToTextureGroup(folder, texture);
      const spritesInParentView = thisView.getChildren("GMSprite", false) as Sprite[];
      const spritesInSubView    = project.getViewByPath(subfolder).getChildren("GMSprite", true) as Sprite[];
      expect(spritesInParentView.length).to.be.greaterThan(0);
      expect(spritesInSubView.length).to.be.greaterThan(0);
      for (const sprite of spritesInParentView) {
        expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(topLevelTextureID);
      }
      for (const sprite of spritesInSubView) {
        expect(sprite.rawDataFromYY.textureGroupId, "Sprite texture ID was not assigned as intended.").to.equal(subTextureID);
      }
    });
  });

  after(function(){
    new Project(sandboxProjectYYPPath);
    //resetSandbox();
  });
});
