import cli_assert from './cli-assert';

export type ImportBaseOptions = {
  sourcePath: string,
  allowExtensions?: string[],
  targetProjectPath?: string,
  force?: boolean,
}

export function normalizeOptions(options: ImportBaseOptions){
  const {sourcePath} = options;
  let {targetProjectPath, allowExtensions} = options;

  cli_assert.assertPathExists(sourcePath);
  if (allowExtensions){
    cli_assert.assertAtLeastOneTruthy(allowExtensions);
  }
  else{
    allowExtensions = [];
  }
  if (targetProjectPath){
    cli_assert.assertPathExists(targetProjectPath);
  }
  else{
    targetProjectPath = process.cwd();
  }

  return {
    sourcePath,
    allowExtensions: cli_assert.getTruthyArgs(allowExtensions),
    targetProjectPath
  };
}