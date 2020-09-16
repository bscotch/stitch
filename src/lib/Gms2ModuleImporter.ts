import { differenceBy } from "lodash";
import { Gms2Resource } from "./components/Gms2Resource";
import { Gms2ResourceSubclass } from "./components/Gms2ResourceArray";
import { Gms2Sound } from "./components/resources/Gms2Sound";
import { Gms2Sprite } from "./components/resources/Gms2Sprite";
import { Gms2PipelineError } from "./errors";
import type { Gms2Project } from "./Gms2Project";
import paths from "./paths";
import { oneline } from "./strings";

export class Gms2ModuleImporter {

  constructor(private fromProject: Gms2Project, private toProject: Gms2Project){}

  static resourcesInModule(project:Gms2Project,moduleName:string){
    return project.folders
      .findModuleFolders(moduleName)
      .map(folder=>project.resources.filterByFolder(folder.path)).flat(1);
  }

  importModules(moduleNames:string[]){
    for(const moduleName of moduleNames){
      this.importModule(moduleName);
    }
  }

  /**
   * Move any existing assets into a folder called "MODULE_CONFLICTS"
   * if they do not exist in expected resources
   */
  moveAlienResources(moduleName:string){
    const localModuleResources = Gms2ModuleImporter.resourcesInModule(this.toProject,moduleName);
    const sourceModuleResources = Gms2ModuleImporter.resourcesInModule(this.fromProject,moduleName);
    const alienResources = differenceBy(localModuleResources,sourceModuleResources,'name');
    if(alienResources.length){
      const conflictFolder = "MODULE_CONFLICTS";
      this.toProject.addFolder(conflictFolder);
      alienResources.forEach(resource=>resource.folder=conflictFolder);
    }
  }

  importModule(moduleName:string){

    this.moveAlienResources(moduleName);

    // For each source asset:
    //   + See if there exists an asset with the same name ANYWHERE in the project
    const sourceModuleResources = Gms2ModuleImporter.resourcesInModule(this.fromProject,moduleName);
    const sourceResourcesToAdd: Gms2ResourceSubclass[] = [];
    /** {source:local} pairs */
    const updatePairs: Map<Gms2Resource, Gms2Resource> = new Map();
    for(const sourceModuleResource of sourceModuleResources){
      const matchingLocalResource = this.toProject.resources
        .findByField('name',sourceModuleResource.name,Gms2Resource);
      if(!matchingLocalResource){
        sourceResourcesToAdd.push(sourceModuleResource);
        continue;
      }
      // If this.target is NOT in the local module, throw an error.
      if(! matchingLocalResource.isInModule(moduleName)){
        throw new Gms2PipelineError(oneline`
          Conflict: local asset ${matchingLocalResource.name} exists
          but is not in the expected module ${moduleName}
        `);
      }
      // If this.target is of a different type, throw an error.
      if( matchingLocalResource.resourceType != sourceModuleResource.resourceType){
        throw new Gms2PipelineError(oneline`
          Conflict: local asset ${matchingLocalResource.name} exists,
          and is in the correct module,
          but does not have the same resource type as the source.
        `);
      }
      // Add to set as pair so that we can use the source as reference
      // without having to search for it again.
      updatePairs.set(sourceModuleResource,matchingLocalResource);
    }

    // Add new resources
    for(const sourceResource of sourceResourcesToAdd){
      this.cloneResourceFiles(sourceResource);
      this.toProject.resources.register(sourceResource.dehydrated,this.toProject.storage);
    }

    // Update matching stuff
    // (Note: we may need more nuance than simply overwriting,
    //  so we can hold onto the localResource reference just in case)
    for(const [sourceResource] of updatePairs){
      this.cloneResourceFiles(sourceResource);
    }

    this.toProject.ensureResourceGroupAssignments();

    // Make sure any audio groups, texture pages, and other content referenced by new/updated
    // resources actually exist.
    this.toProject.resources.forEach(resource=>{
      if(resource instanceof Gms2Sound){
        this.toProject.addAudioGroup(resource.audioGroup);
      }
      else if(resource instanceof Gms2Sprite){
        this.toProject.addTextureGroup(resource.textureGroup);
      }
    });

    this.toProject.save();
  }

  private cloneResourceFiles(sourceResource:Gms2Resource){
    this.toProject.addFolder(sourceResource.folder);
    const localYyDirAbsolute = paths.join(this.toProject.storage.yypDirAbsolute,sourceResource.yyDirRelative);
    this.toProject.storage.copy(sourceResource.yyDirAbsolute,localYyDirAbsolute);
  }
}