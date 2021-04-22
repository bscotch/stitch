import cli_assert from './cli-assert';

export type ImportBaseOptions = {
  source: string;
  extensions?: string[];
  targetProject?: string;
  force?: boolean;
};

export function normalizeOptions(options: ImportBaseOptions) {
  cli_assert.assertPathExists(options.source);
  if (options.extensions) {
    cli_assert.assertAtLeastOneTruthy(options.extensions);
    options.extensions = cli_assert.getTruthyArgs(options.extensions);
  } else {
    options.extensions = [];
  }
  if (options.targetProject) {
    cli_assert.assertPathExists(options.targetProject);
  } else {
    options.targetProject = process.cwd();
  }

  return options;
}
