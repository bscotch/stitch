import cli_assert from './cli-assert.js';

export type ImportBaseOptions = {
  source: string;
  extensions?: string[];
  targetProject?: string;
  force?: boolean;
  watch?: boolean;
};

export function normalizeOptions(options: ImportBaseOptions) {
  // Clone to prevent side effects
  options = { ...options };
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
