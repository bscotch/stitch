#!/usr/bin/env node
import { program } from 'commander';
import {
  addGeneralOptions,
  runFixer,
  SpritelyCliGeneralOptions,
} from './util.js';

async function runCliCommand() {
  addGeneralOptions(
    program.description('Spritely: Fix (run all corrective functions)'),
  ).parse();
  await runFixer(
    ['crop', 'bleed'],
    program.opts() as SpritelyCliGeneralOptions,
  );
}

void runCliCommand();
