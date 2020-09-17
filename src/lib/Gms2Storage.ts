import paths from "./paths";
import { assert } from "./errors";
import fs from "./files";

export class Gms2Storage {

  /** Directory containing a .git file. null means no repo, undefined means no check has occurred. */
  #gitRepoDirectory: string | null | undefined;

  constructor(readonly yypAbsolutePath:string, readonly isReadOnly=false){
    assert(this.gitRepoDirectory, `No git repo found in any parent folder. Too dangerous to proceed.`);
  }

  get yypDirAbsolute(){
    return paths.dirname(this.yypAbsolutePath);
  }

  get gitRepoDirectory() {
    if (typeof this.#gitRepoDirectory == 'undefined') {
      this.#gitRepoDirectory = null;
      // Look for a repo
      let path = this.yypDirAbsolute;
      while (paths.dirname(path) != path) {
        const possibleGitPath = paths.join(path, ".git");
        if (fs.existsSync(possibleGitPath)) {
          this.#gitRepoDirectory = path;
        }
        path = paths.dirname(path);
      }
    }
    return this.#gitRepoDirectory;
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
