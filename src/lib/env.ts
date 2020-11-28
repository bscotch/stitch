/**
 * @file Gather environment variables. Look for a local .env file,
 * and a global (in user home) .?stitch.env file.
 */

import path from 'path';
import fs from 'fs-extra';
import os from 'os';

/** Only return those requested. (Use 'as const' to flag input as readonly ) */
export function loadEnvironmentVariables<T extends Readonly<string[]>>(varNames:T){
  // In lowest-to-highest precedence, in case
  // there are multiple env files.
  const possibleEnvDirs = [
    os.homedir(),
    process.cwd(),
  ];
  const possibleEnvFileNames = [
    '.env',
    '.stitch.env',
    'stitch.env'
  ];
  const env: {[key in typeof varNames[number]]?:string} = {};
  for(const dir of possibleEnvDirs){
    for(const file of possibleEnvFileNames){
      try{
        const filepath = path.join(dir,file);
        const contents = fs.readFileSync(filepath,'utf-8');
        const lines = contents.split(/[\r\n]+/).filter(x=>x);
        for(const line of lines){
          const [,varName,value] = (line.match(/^([^=]+)=(.+)$/)
            ?.map(x=>x.trim()).filter(x=>x) || []) as [string,typeof varNames[number]|undefined,string|undefined];
          if(varName && varNames.includes(varName) && value){
            env[varName] = value;
          }
        }
      }
      catch(err){
        if(err?.code != 'ENOENT'){
          console.log(err);
        }
      }
    }
  }
  return env;
}
