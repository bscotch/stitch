import paths from "./paths";
import { Gms2PipelineError, assert } from "./errors";
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

  ensureDir(dir:string){
    if(!this.isReadOnly){
      fs.ensureDirSync(dir);
    }
  }

  copyFile(sourcePath:string,destinationPath:string){
    assert(fs.existsSync(sourcePath),`copyFile: sourcePath ${sourcePath} does not exist`);
    if(!this.isReadOnly){
      fs.copyFileSync(sourcePath,destinationPath);
      fs.ensureDirSync(paths.dirname(destinationPath));
    }
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

  readJson(filePath:string){
    return fs.readJsonSync(filePath);
  }
}
