import paths from "./paths";
import { assert, Gms2PipelineError } from "./errors";
import fs from "./files";
import child_process from "child_process";

export class Gms2Storage {

  constructor(readonly yypAbsolutePath:string, readonly isReadOnly=false, readonly bypassGitRequirement=false){
    if(!bypassGitRequirement && process.env.GMS2PDK_DEV != 'true' && !this.workingDirIsClean){
      throw new Gms2PipelineError(`GIT ERROR: Working directory is not clean. Commit or stash your work!`);
    }
    if(process.env.GMS2PDK_DEV != 'true'){
      this.installPrecommitHook();
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

  get gitWorkingTreeRoot(){
    const gitProcessHandle = child_process
      .spawnSync(`git worktree list`,{cwd:this.yypDirAbsolute,shell:true});
    if (gitProcessHandle.status != 0){
      throw new Gms2PipelineError(gitProcessHandle.stderr.toString());
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

  installPrecommitHook(){
    const gitRoot = this.gitWorkingTreeRoot;
    const preCommitFilePath = paths.join(gitRoot,'.git','hooks','pre-commit');
    if(fs.existsSync(preCommitFilePath)){
      return;
    }
    const hookCode = `#!/bin/sh

# Gamemaker Studio stores yy and yyp files with trailing commas and non-standard
# spacing. The GMS2 PDK creates standard JSON files with predictable spacing upon save,
# thus causing large numbers of cosmetic file changes that will pollute the Git history.
# This hook forces all yy/yyp files in the repo to be in a standardized JSON format
# prior to commiting, so that the files are always guaranteed to have the exact same
# structure, whether they were last edited by Gamemaker Studio or the PDK.

npx gms2 jsonify
git add *.yy
git add *.yyp
`;
    fs.writeFileSync(preCommitFilePath, hookCode);
    fs.chmodSync(preCommitFilePath,'777');
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
