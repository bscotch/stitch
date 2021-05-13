#!/usr/bin/env node
import { Gms2Project } from '@/Gms2Project';
import commander from 'commander';
import cliOptions from './lib/cli-options';
const cli = commander;

cli
  .description('Generate a lint report.')
  .option('--suffix', 'Filter out results that do not have the suffix')
  .option(...cliOptions.targetProject)
  .option(...cliOptions.force)
  .parse(process.argv);

const opts = cli.opts();
const project = new Gms2Project({
  projectPath: opts.targetProject,
  dangerouslyAllowDirtyWorkingDir: opts.force,
});

const lintResults = project.lint({ versionSuffix: opts.suffix });
console.log(lintResults.getReportString());
