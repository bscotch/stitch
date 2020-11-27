import { Gms2ImportModulesOptions } from '../../lib/Gms2ModuleImporter';
import { Gms2Project } from '../../lib/Gms2Project';
import { unzipRemote } from '../../lib/http';
import assertions from './cli-assert';
import {md5} from "@bscotch/utility";
import path from "path";
import fs from "fs-extra";
import { assert, StitchError } from '../../lib/errors';

export interface ImportModuleOptions extends Gms2ImportModulesOptions {
  sourceProjectPath?: string,
  sourceUrl?:string,
  sourceGithub?: string,
  modules?: string[],
  targetProjectPath ?: string,
  force?: boolean,
}

// If the source is from a remote, get figure out its URL for use downstream.
function normalizeUrl(options:ImportModuleOptions){
  const sources = [options.sourceProjectPath,options.sourceGithub,options.sourceUrl];
  assert(sources.filter(x=>x).length==1,'Exactly one source must be set.');
  // If not local, convert to local and then set that variable.
  if(options.sourceProjectPath){
    return;
  }
  let url = options.sourceUrl as string|undefined;
  if(!url && options.sourceGithub){
    // Create the GitHub URL.
    const repo = options.sourceGithub
      .match(/^(?<owner>[a-z0-9_.-]+)\/(?<name>[a-z0-9_.-]+)(@(?<version>[a-z0-9_.-]+))?$/i)
      ?.groups as unknown as {owner:string,name:string,version?:string};
    if(!repo){
      throw new StitchError(
        `Github source must match pattern {owner}/{repo-name}@{version} (where @{version} is optional).`
      );
    }
    url = `https://github.com/${repo.owner}/${repo.name}/archive/${repo.version||'HEAD'}.zip`;
  }
  options.sourceUrl = url;
}

export default async function(options: ImportModuleOptions){
  normalizeUrl(options);
  options.targetProjectPath ||= process.cwd();
  assertions.assertPathExists(options.targetProjectPath);
  const targetProject = new Gms2Project({
    projectPath: options.targetProjectPath,
    dangerouslyAllowDirtyWorkingDir: options.force
  });

  let unzipPath: string|undefined;
  if(options.sourceUrl){
    unzipPath = path.join(
      path.dirname(targetProject.yypAbsolutePath),
      `tmp-${md5(options.sourceUrl)}`
    );
    options.sourceProjectPath = await unzipRemote(options.sourceUrl,unzipPath);
  }
  assertions.assertPathExists(options.sourceProjectPath);
  targetProject.importModules(options.sourceProjectPath as string,options.modules,options);
  if(unzipPath){
    fs.emptyDirSync(unzipPath);
    fs.removeSync(unzipPath);
  }
}
