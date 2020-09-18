import paths from "./paths";
import { assert, Gms2PipelineError } from "./errors";
import fs from "./files";
import child_process from "child_process";

export class Gms2Storage {

  constructor(readonly yypAbsolutePath:string, readonly isReadOnly=false){
    if(!this.workingDirIsClean && process.env.GMS2PDK_DEV != 'true'){
      throw new Gms2PipelineError(`GIT ERROR: Working directory is not clean. Commit or stash your work!`);
    }
  }

  get yypDirAbsolute(){
    return paths.dirname(this.yypAbsolutePath);
  }

  get workingDirIsClean(){
    const gitProcessHandle = child_process
      .spawnSync(`git status`,{cwd:this.yypDirAbsolute,shell:true});
    if (gitProcessHandle.status != 0){
      throw new Gms2PipelineError(gitProcessHandle.stderr.toString());
    }
    else{
      const isClean = gitProcessHandle.stdout.toString().includes('working tree clean');
      return isClean;
    }
  }

  toAbsolutePath(pathRelativeToYypDir:string){
    return paths.join(this.yypDirAbsolute,pathRelativeToYypDir);
  }

  ensureDir(dir:string){
    if(!this.isReadOnly){
      fs.ensureDirSync(dir);
    }
  }

  listFiles(dir:string,recursive?:boolean){
    return fs.listFilesSync(dir,recursive);
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

  copyFile(sourcePath:string,destinationPath:string){
    assert(fs.existsSync(sourcePath),`copyFile: sourcePath ${sourcePath} does not exist`);
    if(!this.isReadOnly){
      fs.copyFileSync(sourcePath,destinationPath);
      fs.ensureDirSync(paths.dirname(destinationPath));
    }
  }

  asPosixPath(path:string){
    return paths.asPosixPath(path);
  }

  saveBlob(filePath:string,data:string|Buffer){
    if(!this.isReadOnly){
      fs.writeFileSync(filePath,data);
    }
  }

  saveJson(filePath:string,data:any){
    if(!this.isReadOnly){
      fs.writeJsonSync(filePath,data);
    }
  }

  loadBlob(filePath:string){
    return fs.readFileSync(filePath);
  }

  loadJson(filePath:string){
    return fs.readJsonSync(filePath);
  }
}
