import { program } from 'commander';
import {
  addGeneralOptions,
  runFixer,
  SpritelyCliGeneralOptions,
} from './util.js';

async function runCliCommand() {
  addGeneralOptions(program.description('Spritely: Crop subimages')).parse();

  await runFixer('crop', program.opts() as SpritelyCliGeneralOptions);
}

void runCliCommand();
