import paths from "./paths";
import { assert, StitchError } from "./errors";
import fs from "./files";
import child_process from "child_process";
import { oneline } from "@bscotch/utility";

export class Gms2Storage {

  constructor(readonly yypAbsolutePath:string, readonly isReadOnly=false, readonly bypassGitRequirement=false){
    if(!bypassGitRequirement && process.env.GMS2PDK_DEV != 'true' && !this.workingDirIsClean){
      throw new StitchError(oneline`
        Working directory for ${paths.basename(yypAbsolutePath)} is not clean. Commit or stash your work!
      `);
    }
  }

  get yypDirAbsolute(){
    return paths.dirname(this.yypAbsolutePath);
  }

  get workingDirIsClean(){
    const gitProcessHandle = child_process
      .spawnSync(`git status`,{cwd:this.yypDirAbsolute,shell:true});
    if (gitProcessHandle.status != 0){
      throw new StitchError(gitProcessHandle.stderr.toString());
    }
    else{
      const isClean = gitProcessHandle.stdout.toString().includes('working tree clean');
      return isClean;
    }
  }

  get gitWorkingTreeRoot(){
    const gitProcessHandle = child_process
      .spawnSync(`git worktree list`,{cwd:this.yypDirAbsolute,shell:true});
    if (gitProcessHandle.status != 0){
      throw new StitchError(gitProcessHandle.stderr.toString());
    }
    return gitProcessHandle.stdout.toString()
      .split(/\s+/g)[0];
  }

  toAbsolutePath(pathRelativeToYypDir:string){
    return paths.join(this.yypDirAbsolute,pathRelativeToYypDir);
  }

  ensureDir(dir:string){
    if(!this.isReadOnly){
      fs.ensureDirSync(dir);
    }
  }

  /** Delete all files and folders (recursively) inside this directory. */
  emptyDir(dir:string){
    if(!this.isReadOnly){
      fs.emptyDirSync(dir);
    }
  }

  deleteFile(path:string){
    if(!this.isReadOnly){
      fs.removeSync(path);
    }
  }

  listFiles(dir:string,recursive?:boolean,allowedExtension?:string[]){
    if (allowedExtension && allowedExtension.length > 0){
      return fs.listFilesByExtensionSync(dir, allowedExtension, recursive);
    }
    else{
      return fs.listFilesSync(dir,recursive);
    }
  }

  listPaths(dir:string,recursive?:boolean){
    return fs.listPathsSync(dir,recursive);
  }

  /** Copy a file or recursively copy a directory */
  copy(from:string,to:string){
    return fs.copySync(from,to,{overwrite:true});
  }

  exists(path:string){
    return fs.existsSync(path);
  }

  isFile(path:string){
    return fs.statSync(path).isFile();
  }

  isDirectory(path:string){
    return fs.statSync(path).isDirectory();
  }

  copyFile(source:string,destinationPath:string){
    assert(fs.existsSync(source),`copyFile: source ${source} does not exist`);
    if(!this.isReadOnly){
      fs.copyFileSync(source,destinationPath);
      fs.ensureDirSync(paths.dirname(destinationPath));
    }
  }

  asPosixPath(path:string){
    return paths.asPosixPath(path);
  }

  writeBlob(filePath:string,data:string|Buffer){
    if(!this.isReadOnly){
      fs.writeFileSync(filePath,data);
    }
  }

  /** Write data as JSON, defaulting to GMS2.3-style JSON
   * @param {boolean} [plain] Use regular JSON instead of GMS2.3-style.
   */
  writeJson(filePath:string,data:any,plain=false){
    if(!this.isReadOnly){
      fs.writeJsonSync(filePath,data,plain);
    }
  }

  readBlob(filePath:string){
    return fs.readFileSync(filePath);
  }

  readJson(filePath:string){
    return fs.readJsonSync(filePath);
  }
}
