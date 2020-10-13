import cli_assert from './cli-assert';

export type ImportBaseOptions = {
  sourcePath: string,
  allowExtensions?: string[],
  targetProjectPath?: string,
  force?: boolean,
}

export function normalizeOptions(options: ImportBaseOptions){
  cli_assert.assertPathExists(options.sourcePath);
  if (options.allowExtensions){
    cli_assert.assertAtLeastOneTruthy(options.allowExtensions);
    options.allowExtensions = cli_assert.getTruthyArgs(options.allowExtensions);
  }
  else{
    options.allowExtensions = [];
  }
  if (options.targetProjectPath){
    cli_assert.assertPathExists(options.targetProjectPath);
  }
  else{
    options.targetProjectPath = process.cwd();
  }

  return options;
}