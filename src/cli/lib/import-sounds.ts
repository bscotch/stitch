import { Gms2Project } from '../../lib/Gms2Project';
import cli_assert from './cli-assert';
import fs from '../../lib/files'

export type ImportSoundsOptions = {
  source_path: string,
  extensions?: string[],
  target_project_path?: string
}

export default function(options: ImportSoundsOptions){
  const {source_path, extensions} = options;
  let {target_project_path} = options;

  cli_assert.assertPathExists(source_path);
  if (fs.statSync(source_path).isFile() && extensions){
    cli_assert.assertMutualExclusion(source_path, extensions);
  }
  if (extensions){
    cli_assert.assertAtLeastOneTruthy(extensions);
  }
  if (target_project_path){
    cli_assert.assertPathExists(target_project_path);
  }
  else{
    target_project_path = process.cwd();
  }

  const targetProject = new Gms2Project(target_project_path);
  if (fs.statSync(source_path).isFile()){
    targetProject.addSound(source_path);
  }
  else{
    targetProject.batchAddSound(source_path, extensions);
  }
}