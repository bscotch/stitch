import { Gms2Project } from '../../lib/Gms2Project';
import cli_assert from './cli-assert';
import fs from '../../lib/files';

export type ImportSoundsOptions = {
  source_path: string,
  allow_extensions?: string[],
  target_project_path?: string
}

export default function(options: ImportSoundsOptions){
  const {source_path} = options;
  let {target_project_path, allow_extensions} = options;

  cli_assert.assertPathExists(source_path);
  if (allow_extensions){
    cli_assert.assertAtLeastOneTruthy(allow_extensions);
  }
  else{
    allow_extensions = [];
  }
  if (target_project_path){
    cli_assert.assertPathExists(target_project_path);
  }
  else{
    target_project_path = process.cwd();
  }

  const targetProject = new Gms2Project(target_project_path);
  targetProject.addSounds(source_path, cli_assert.getTruthyArgs(allow_extensions));
}