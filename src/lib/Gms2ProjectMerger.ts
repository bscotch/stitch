import { differenceBy } from "lodash";
import { Gms2IncludedFile } from "./components/Gms2IncludedFile";
import { Gms2ResourceBase } from "./components/resources/Gms2ResourceBase";
import { Gms2ResourceSubclass, Gms2ResourceType } from "./components/Gms2ResourceArray";
import { Gms2Sound } from "./components/resources/Gms2Sound";
import { Gms2Sprite } from "./components/resources/Gms2Sprite";
import { assert, StitchError } from "./errors";
import type { Gms2Project } from "./Gms2Project";
import paths from "./paths";
import { oneline, undent } from "@bscotch/utility";
import { logInfo, logWarning } from "./log";
import { Gms2Object } from "./components/resources/Gms2Object";

type ClobberAction = 'error'|'skip'|'overwrite';

export interface Gms2MergerOptions {
  /**
   * List of source folder patterns that, if matched,
   * should have all child assets imported (recursive).
   * Will be passed to `new RegExp()` and tested against
   * the parent folder of every source resource.
   * Independent from ifNameMatches.
   */
  ifFolderMatches?: string[],
  /**
   * List of source resource name patterns that, if matched,
   * should have all child assets imported (recursive).
   * Will be passed to `new RegExp()` and tested against
   * the name of every source resource.
   * Independent from ifFolderMatches.
   */
  ifNameMatches?: string[],
  /**
   * By default, Included Files are also tested against
   * the merge patterns. Files can be excluded from merging.
   */
  skipIncludedFiles?: boolean,
  /**
   * Resource types whitelist. If not provided, all resource
   * types are merged.
   */
  types?: Gms2ResourceType[],
  /**
   * Normally all dependencies (parent objects and sprites)
   * for the objects within the modules must also be in those
   * modules (modules don't have to be self-contained, but the
   * collection of imported modules does.) You can bypass
   * that requirement.
   */
  skipDependencyCheck?:boolean,
  /**
   * If the target project already has the source module,
   * it may have assets in it that are *not* in the source.
   * This can create confusion about which assets come from
   * which source. You can reduce this confusion by having
   * conflicting target assets moved into a 'MERGE_CONFLICTS'
   * folder for later re-organization.
   */
  moveConflicting?:boolean,
  /**
   * If source assets match target assets by name,
   * but have mismatched parent folders, an error is raised.
   * This is to prevent
   * accidental overwrite of assets that happen to have the
   * same name but aren't actually the same thing.
   * You can change the behavior to instead skip importing
   * those assets (keeping the target version) or overwrite
   * (deleting the target version and keeping the source
   * version). Note that assets of different type that have
   * the same name will *always* raise an error.
   */
  onClobber?:ClobberAction,
}

export class Gms2ProjectMerger {
  private options: Gms2MergerOptions;

  constructor(private sourceProject: Gms2Project, private targetProject: Gms2Project, options?: Gms2MergerOptions){
    this.options = options || {};
    this.options.onClobber ??= 'overwrite';
    if(! this.options.ifFolderMatches && !this.options.ifNameMatches ){
      // Then we aren't whitelisting.
      this.options.ifFolderMatches = ['.*'];
    }
  }

  merge(){

    const toImport = this.sourceProject.resources.filter(resource=>this.resourceMatchesOptions(resource));
    if(!this.options.skipDependencyCheck){
      toImport.forEach(resource=>this.assertAllDependenciesFound(resource,toImport));
    }

    const targetResources = this.targetProject.resources.all;

    logInfo(`Merging...`);
    // See which target resources match the options pattern but are not in the source
    for(const targetResource of targetResources){
      this.handleResourceConflict(targetResource,toImport);
    }
    // Import all resources matching the pattern.
    for(const sourceResource of toImport){
      this.importResource(sourceResource);
    }
    if(!this.options.skipIncludedFiles){
      this.importIncludedFiles();
    }

    // Make sure any audio groups, texture pages, configs and other content referenced by new/updated
    // resources actually exist.
    this.targetProject.ensureResourceGroupAssignments();
    this.targetProject.resources.forEach(resource=>{
      if(resource instanceof Gms2Sound){
        this.targetProject.addAudioGroup(resource.audioGroup);
      }
      else if(resource instanceof Gms2Sprite){
        this.targetProject.addTextureGroup(resource.textureGroup);
      }
      for(const configName of resource.configNames){
        this.targetProject.addConfig(configName);
      }
    });
    this.targetProject.save();
    logInfo(`Merge complete!`);
  }


  private resourcesMatch(resource1:Gms2ResourceSubclass,resource2:Gms2ResourceSubclass,requireSameFolder=false){
    return resource1.name == resource2.name &&
      resource1.type == resource2.type &&
      (!requireSameFolder || resource1.folder==resource2.folder);
  }

  private assertAllDependenciesFound(resource:Gms2ResourceSubclass,allResources:Gms2ResourceSubclass[]){
    if(resource.type!='objects'){
      return false;
    }
    const object = resource as Gms2Object;
    if(object.parentName){
      const parentIsInModules = allResources
        .find(resource=>resource.type=='objects' && resource.name==object.parentName);
      assert(parentIsInModules,oneline`
        Parent "${object.parentName}" for object "${object.name}" is not in the imported modules
      `);
    }
    if(object.spriteName){
      const spriteIsInModules = allResources
        .find(resource=>resource.type=='sprites' && resource.name==object.spriteName);
      assert(spriteIsInModules,oneline`
        Sprite "${object.spriteName}" for object "${object.name}" is not in the imported modules
      `);
    }
  }

  private resourceMatchesOptions(resource:Gms2ResourceSubclass|Gms2IncludedFile){
    if(!(resource instanceof Gms2IncludedFile) && this.options.types?.length){
      if(!this.options.types.includes(resource.type)){
        return false;
      }
    }
    for(const matcher of this.options.ifFolderMatches||[]){
      if(resource.folder.match(new RegExp(matcher,'i'))){
        return true;
      }
    }
    for(const matcher of this.options.ifNameMatches||[]){
      if(resource.name.match(new RegExp(matcher,'i'))){
        return true;
      }
    }
    return false;
  }

  /**
   * Move any target module assets into a folder called "MERGE_CONFLICTS"
   * if they do not exist in the source module (if desired).
   */
  private handleResourceConflict(targetResource: Gms2ResourceSubclass, toImport: Gms2ResourceSubclass[]){
    const isExtra = this.resourceMatchesOptions(targetResource) && // Would be imported if in source
      // But not in source
      ! toImport.find(sourceResource=>this.resourcesMatch(sourceResource,targetResource));
    if(isExtra && this.options.moveConflicting){
      const conflictFolder = "MERGE_CONFLICTS";
      this.targetProject.addFolder(conflictFolder);
      targetResource.folder=conflictFolder;
      logInfo(`Moved conflicting asset "${targetResource.name}" into ${conflictFolder} folder`);
    }
    else if(isExtra){
      logWarning(oneline`
        Target asset "${targetResource.name}" matches the merge pattern but is not in the source.
        It was left alone. To have such resources moved, set the 'moveConflicting' option to 'true'.`
      );
    }
  }

  private importResource(sourceResource: Gms2ResourceSubclass){
    // For each source asset:
    //   + See if there exists an asset with the same name ANYWHERE in the project
    const matchingTarget = this.targetProject.resources
      .find(targetResource=>this.resourcesMatch(targetResource,sourceResource));
    if(!matchingTarget){
      this.cloneResourceFiles(sourceResource);
      this.targetProject.resources.register(sourceResource.toJSON(),this.targetProject.storage);
      logInfo(`Added new resource ${sourceResource.name}.`);
      return;
    }
    // Else we're going to either overwrite or throw an error, depending on circumstances
    // and options.
    const warningMessage = oneline`
      Local asset ${matchingTarget.name} exists but does not match merge pattern.
    `;
    const howToChangeMessage = oneline`
      Rename the source or target asset, or set 'onClobber'
      to 'overwrite' or 'error' to change this behavior.
    `;

    const matchesPattern = this.resourceMatchesOptions(matchingTarget);
    if(matchesPattern){
      this.cloneResourceFiles(sourceResource);
    }
    else if(this.options.onClobber=='skip'){
      logWarning(oneline`
        ${warningMessage}
        Import skipped (local version is unchanged).
        ${howToChangeMessage}
      `);
      return;
    }
    else if(this.options.onClobber=='error'){
      throw new StitchError(oneline`
        ${warningMessage} ${howToChangeMessage}
      `);
    }
    else{
      logWarning(oneline`
        ${warningMessage}
        Import will occur anyway (the local asset will be replaced).
        ${howToChangeMessage}
      `);
      this.cloneResourceFiles(sourceResource);
    }
  }

  private importIncludedFiles(){
    const sourceModuleFiles = this.sourceProject.includedFiles
      .filter(file=>this.resourceMatchesOptions(file));

    // Loop over the sourcefiles and see if we can simply replace them in the target
    for(const sourceModuleFile of sourceModuleFiles){
      let matchingTarget = this.targetProject.includedFiles
        .findByField('name',sourceModuleFile.name);
      if(!matchingTarget){
        // Trim off the 'datafiles' parent folder
        const subdir = sourceModuleFile.folder;
        matchingTarget = this.targetProject
          .addIncludedFiles(
            sourceModuleFile.filePathAbsolute,
            {subdirectory:subdir}
          )[0] as Gms2IncludedFile;
        // Check the Config status of the source and match it to the target
        // (including adding configs if they don't exist)
        matchingTarget.config = sourceModuleFile.config;
        for(const name of matchingTarget.configNames){
          this.targetProject.addConfig(name);
        }
        continue;
      }
      else if(this.resourceMatchesOptions(matchingTarget)||this.options.onClobber=='overwrite'){
        // Overwrite from source
        matchingTarget.replaceWithFileContent(sourceModuleFile.filePathAbsolute);
        if( ! this.resourceMatchesOptions(matchingTarget)){
          logWarning(oneline`
            File ${matchingTarget.name} will be overwritten by the source file,
            even though it does not match the merge pattern. Prevent this by
            changing the filename in the source or target, or by setting
            'onClobber' to 'error' or 'skip'.
          `);
        }
        continue;
      }
      else if(this.options.onClobber=='error'){
        // Exists but not in module: CONFLICT
        throw new StitchError(oneline`
          Conflict: local asset ${sourceModuleFile.name} exists,
          but does not match the merge pattern. You can either skip
          conflicting imports or allow them anyway by setting
          'onclobber' to 'skip' or 'overwrite'.
        `);
      }
      // else we're skipping, so can proceed to the next loop turn
    }
    if(this.options.moveConflicting){
      // If there are any files in the target module that are NOT in the source module,
      // throw an error so the user can resolve this (it won't actually break anything,
      // but is likely to create confusion downstream if not addressed)
      const localModuleFiles  = this.targetProject.includedFiles
        .filter(file=>this.resourceMatchesOptions(file));
      const extraFiles = differenceBy(localModuleFiles,sourceModuleFiles,'name');
      if(extraFiles.length){
        throw new StitchError(undent`
        CONFLICT: The following files were NOT in the source module but are in the target module.
          ${extraFiles.map(file=>file.name).join(', ')}
        `);
      }
    }
  }

  private cloneResourceFiles(sourceResource:Gms2ResourceBase){
    this.targetProject.addFolder(sourceResource.folder);
    const localYyDirAbsolute = paths.join(this.targetProject.storage.yypDirAbsolute,sourceResource.yyDirRelative);
    this.targetProject.storage.copy(sourceResource.yyDirAbsolute,localYyDirAbsolute);
  }
}