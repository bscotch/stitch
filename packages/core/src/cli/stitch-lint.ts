#!/usr/bin/env node
import { program as cli } from 'commander';
import { StitchProject } from '../lib/StitchProject.js';
import cliOptions from './lib/cli-options.js';

cli
  .description('Generate a lint report.')
  .option('--suffix', 'Filter out results that do not have the suffix')
  .option(...cliOptions.targetProject)
  .option(...cliOptions.force)
  .parse(process.argv);

const opts = cli.opts();
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
