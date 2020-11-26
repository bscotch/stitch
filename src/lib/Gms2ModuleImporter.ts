import { differenceBy } from "lodash";
import { Gms2IncludedFile } from "./components/Gms2IncludedFile";
import { Gms2ResourceBase } from "./components/resources/Gms2ResourceBase";
import { Gms2ResourceSubclass } from "./components/Gms2ResourceArray";
import { Gms2Sound } from "./components/resources/Gms2Sound";
import { Gms2Sprite } from "./components/resources/Gms2Sprite";
import { assert, StitchError } from "./errors";
import type { Gms2Project } from "./Gms2Project";
import paths from "./paths";
import { oneline, undent } from "@bscotch/utility";
import { logInfo, logWarning } from "./log";
import { Gms2Object } from "./components/resources/Gms2Object";
import { option } from "commander";
import { match } from "assert";

type ClobberAction = 'error'|'skip'|'overwrite';

export interface Gms2ImportModulesOptions {
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
   * By default these are moved into a separate folder so
   * that source and target module assets directly match.
   * You can override this behavior.
   */
  doNotMoveConflicting?:boolean,
  /**
   * If source module assets match target assets by name,
   * but those matching assets are not in the same module
   * in the target, an error is raised. This is to prevent
   * accidental overwrite of assets that happen to have the
   * same name but aren't actually the same thing.
   * You can change the behavior to instead skip importing
   * those assets (keeping the target version) or overwrite
   * (deleting the target version and keeping the source
   * version)
   */
  onClobber?:ClobberAction,
}

export class Gms2ModuleImporter {

  constructor(private fromProject: Gms2Project, private toProject: Gms2Project){}

  /**
   * An empty or undefined list of module names is interpreted to
   * mean import *all* assets, by using root folder names as
   * module names. When importing all assets, the options
   * defaults change to `{doNotMoveConflicting:true,onClobber:'overwrite'},
   * which can be dangerous.`
   */
  importModules(moduleNames?:string[],options?:Gms2ImportModulesOptions){
    options = options || {};
    if(!moduleNames?.length){
      // Then use root folders as modules and set options defaults
      // to have the most likely intended outcome.
      options.onClobber            ??= 'overwrite';
      options.skipDependencyCheck  ??= true;
      options.doNotMoveConflicting ??= true;
      moduleNames = this.fromProject.folders
        .filter(folder => !folder.path.includes('/'))
        .map(folder => folder.name);
    }

    if(!options.skipDependencyCheck){
      const sourceResources = moduleNames
        .map(moduleName=>Gms2ModuleImporter.resourcesInModule(this.fromProject,moduleName)).flat(2);
      for(const sourceResource of sourceResources){
        if(sourceResource.type!='objects'){
          continue;
        }
        const object = sourceResource as Gms2Object;
        if(object.parentName){
          const parentIsInModules = sourceResources
            .find(resource=>resource.type=='objects' && resource.name==object.parentName);
          assert(parentIsInModules,oneline`
            Parent "${object.parentName}" for object "${object.name}" is not in the imported modules
          `);
        }
        if(object.spriteName){
          const spriteIsInModules = sourceResources
            .find(resource=>resource.type=='sprites' && resource.name==object.spriteName);
          assert(spriteIsInModules,oneline`
            Sprite "${object.spriteName}" for object "${object.name}" is not in the imported modules
          `);
        }
      }
    }

    for(const moduleName of moduleNames){
      this.importModule(moduleName,options);
    }
  }

  static resourcesInModule(project:Gms2Project,moduleName:string){
    return project.folders
      .findModuleFolders(moduleName)
      .map(folder=>project.resources.filterByFolder(folder.path)).flat(1);
  }

  static moduleIncludedFiles(project:Gms2Project, moduleName:string){
    return project.includedFiles.filterByModule(moduleName);
  }

  /**
   * Move any target module assets into a folder called "MODULE_CONFLICTS"
   * if they do not exist in the source module
   */
  private moveConflictingResources(moduleName:string){
    const localModuleResources = Gms2ModuleImporter.resourcesInModule(this.toProject,moduleName);
    const sourceModuleResources = Gms2ModuleImporter.resourcesInModule(this.fromProject,moduleName);
    const alienResources = differenceBy(localModuleResources,sourceModuleResources,'name');
    if(alienResources.length){
      const conflictFolder = "MODULE_CONFLICTS";
      this.toProject.addFolder(conflictFolder);
      for(const resource of alienResources){
        resource.folder=conflictFolder;
        logInfo(`moved conflicting asset ${resource.name} into MODULE_CONFLICTS folder`);
      }
    }
  }

  private importResources(moduleName:string,onClobber:ClobberAction='error'){
    // For each source asset:
    //   + See if there exists an asset with the same name ANYWHERE in the project
    const sourceModuleResources = Gms2ModuleImporter.resourcesInModule(this.fromProject,moduleName);
    const sourceResourcesToAdd: Gms2ResourceSubclass[] = [];
    /** {source:local} pairs */
    const updatePairs: Map<Gms2ResourceBase, Gms2ResourceBase> = new Map();
    for(const sourceModuleResource of sourceModuleResources){
      const matchingLocalResource = this.toProject.resources
        .findByField('name',sourceModuleResource.name,Gms2ResourceBase);
      if(!matchingLocalResource){
        sourceResourcesToAdd.push(sourceModuleResource);
        continue;
      }
      // If this.target is NOT in the local module, throw an error.
      if(! matchingLocalResource.isInModule(moduleName)){
        const warningMessage = oneline`
          Local asset ${matchingLocalResource.name} exists
          but is not in the expected module ${moduleName}.
        `;
        const howToChangeMessage = oneline`
          Rename the source or target asset, or set 'onClobber'
          to 'overwrite' or 'error' to change this behavior.
        `;
        if(onClobber=='skip'){
          logWarning(oneline`
            ${warningMessage}
            Import skipped (local version is unchanged).
            ${howToChangeMessage}
          `);
          continue;
        }
        else if(onClobber=='error'){
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
        }
      }
      // If this.target is of a different type, throw an error.
      if( matchingLocalResource.resourceType != sourceModuleResource.resourceType){
        throw new StitchError(oneline`
          Conflict: local asset ${matchingLocalResource.name} exists
          but does not have the same resource type as the source.
          Rename the local or source asset and try again.
        `);
      }
      // Add to set as pair so that we can use the source as reference
      // without having to search for it again.
      updatePairs.set(sourceModuleResource,matchingLocalResource);
    }

    // Add new resources
    for(const sourceResource of sourceResourcesToAdd){
      this.cloneResourceFiles(sourceResource);
      this.toProject.resources.register(sourceResource.toJSON(),this.toProject.storage);
    }
    if(sourceResourcesToAdd.length){
      logInfo(`added ${sourceResourcesToAdd.length} new resources`);
    }

    // Update matching stuff
    // (Note: we may need more nuance than simply overwriting,
    //  so we can hold onto the localResource reference just in case)
    for(const [sourceResource] of updatePairs){
      this.cloneResourceFiles(sourceResource);
    }
    if(updatePairs.size){
      logInfo(`updated ${updatePairs.size} resources`);
    }

    this.toProject.ensureResourceGroupAssignments();

    // Make sure any audio groups, texture pages, configs and other content referenced by new/updated
    // resources actually exist.
    this.toProject.resources.forEach(resource=>{
      if(resource instanceof Gms2Sound){
        this.toProject.addAudioGroup(resource.audioGroup);
      }
      else if(resource instanceof Gms2Sprite){
        this.toProject.addTextureGroup(resource.textureGroup);
      }
      for(const configName of resource.configNames){
        this.toProject.addConfig(configName);
      }
    });
  }

  private importIncludedFiles(moduleName:string,onClobber:ClobberAction='error',doNotMoveConflicting=true){
    const sourceModuleFiles = Gms2ModuleImporter.moduleIncludedFiles(this.fromProject,moduleName);

    // Loop over the sourcefiles and see if we can simply replace them in the target
    for(const sourceModuleFile of sourceModuleFiles){
      let matching = this.toProject.includedFiles
        .findByField('name',sourceModuleFile.name);
      if(!matching){
        // Trim off the 'datafiles' parent folder
        const subdir = sourceModuleFile.directoryRelative
          .replace(/.*?datafiles[/\\]/g, "");
        matching = this.toProject
          .addIncludedFiles(
            sourceModuleFile.filePathAbsolute,
            {subdirectory:subdir}
          )[0] as Gms2IncludedFile;
        // Check the Config status of the source and match it to the target
        // (including adding configs if they don't exist)
        matching.config = sourceModuleFile.config;
        for(const name of matching.configNames){
          this.toProject.addConfig(name);
        }
        continue;
      }
      else if(matching.isInModule(moduleName)||onClobber=='overwrite'){
        // Overwrite from source
        matching.replaceWithFileContent(sourceModuleFile.filePathAbsolute);
        if(onClobber=='overwrite'){
          logWarning(oneline`
            File ${matching.name} will be overwritten by the source file,
            even though they are in different modules. Prevent this by
            changing the filename in the source or target, or by setting
            'onclobber' to 'error' or 'skip'.
          `);
        }
        continue;
      }
      else if(onClobber=='error'){
        // Exists but not in module: CONFLICT
        throw new StitchError(oneline`
          Conflict: local asset ${sourceModuleFile.name} exists,
          but is not in the ${moduleName} module. You can either skip
          conflicting imports or allow them anyway by setting
          'onclobber' to 'skip' or 'overwrite'.
        `);
      }
    }
    if(!doNotMoveConflicting){
      // If there are any files in the target module that are NOT in the source module,
      // throw an error so the user can resolve this (it won't actually break anything,
      // but is likely to create confusion downstream if not addressed)
      const localModuleFiles  = Gms2ModuleImporter.moduleIncludedFiles(this.toProject,moduleName);
      const extraFiles = differenceBy(localModuleFiles,sourceModuleFiles,'name');
      if(extraFiles.length){
        throw new StitchError(undent`
        CONFLICT: The following files were NOT in the source module but are in the target module.
          ${extraFiles.map(file=>file.name).join(', ')}
        `);
      }
    }
  }

  importModule(moduleName:string,options?:Gms2ImportModulesOptions){
    logInfo(`importing module: ${moduleName}`);
    if(!options?.doNotMoveConflicting){
      this.moveConflictingResources(moduleName);
    }
    this.importResources(moduleName,options?.onClobber);
    this.importIncludedFiles(moduleName,options?.onClobber,options?.doNotMoveConflicting);
    this.toProject.save();
    logInfo(`${moduleName} module import complete`);
  }

  private cloneResourceFiles(sourceResource:Gms2ResourceBase){
    this.toProject.addFolder(sourceResource.folder);
    const localYyDirAbsolute = paths.join(this.toProject.storage.yypDirAbsolute,sourceResource.yyDirRelative);
    this.toProject.storage.copy(sourceResource.yyDirAbsolute,localYyDirAbsolute);
  }
}