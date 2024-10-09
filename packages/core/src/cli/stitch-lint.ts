#!/usr/bin/env node
import { cli, chain } from 'cli-forge';
import { StitchProject } from '../lib/StitchProject.js';
import cliOptions from './lib/cli-options.js';

export const lintCommand = cli('lint', {
  description: 'Generate a lint report for a GameMaker Studio 2 project.',
  builder: (cli) =>
    chain(cli, cliOptions.targetProject, cliOptions.force).option('suffix', {
      description: 'Filter out results that do not have the suffix',
      type: 'string',
    }),
  handler: async (opts) => {
    const project = await StitchProject.load({
      projectPath: opts.targetProject,
      dangerouslyAllowDirtyWorkingDir: opts.force,
    });

    const lintResults = project.lint({ versionSuffix: opts.suffix });
    const { outdatedFunctionReferences, nonreferencedFunctions } =
      lintResults.getReport();
    outdatedFunctionReferences?.forEach((outdatedRef) => {
      console.log(outdatedRef.name);
      console.log(outdatedRef.location.line);
      console.log(
        `Outdated reference at: ${outdatedRef.name}, line ${outdatedRef.location.line}, column ${outdatedRef.location.column}`,
      );
    });

    nonreferencedFunctions?.forEach((ref) => {
      console.log(ref.name);
      console.log(ref.location.line);
      console.log(
        `Non-referenced function at: ${ref.name}, line ${ref.location.line}, column ${ref.location.column}`,
      );
    });
  },
});
