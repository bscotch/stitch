import cli_assert from './cli-assert';

export type ImportBaseOptions = {
  source_path: string,
  allow_extensions?: string[],
  target_project_path?: string
}

export function normalizeOptions(options: ImportBaseOptions){
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

  return {
    source_path,
    allow_extensions: cli_assert.getTruthyArgs(allow_extensions),
    target_project_path
  };
}