import { program } from 'commander';
import {
  addGeneralOptions,
  runFixer,
  SpritelyCliGeneralOptions,
} from './util.js';

async function runCliCommand() {
  addGeneralOptions(program.description('Spritely: Bleed subimages')).parse();

  await runFixer('bleed', program.opts() as SpritelyCliGeneralOptions);
}

void runCliCommand();
