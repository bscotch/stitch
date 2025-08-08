#!/usr/bin/env node
import { applyGroupAssignments, ensureProjectConfig } from './project.js';

const [command, ...args] = process.argv.slice(2);

if (command === 'init') {
  const [yypFile] = args;
  if (!yypFile || askingForHelp(yypFile)) {
    console.error('Usage: stitch-config init <yypFile>');
    console.error(
      '\nEnsures that a Stitch Config file exists for the target project.',
    );
    process.exit(1);
  }
  await ensureProjectConfig(yypFile);
} else if (command === 'sync-groups') {
  const [yypFile] = args;
  if (!yypFile || askingForHelp(yypFile)) {
    console.error('Usage: stitch-config sync-groups <yypFile>');
    console.error(
      '\nUpdate Sprites and Sounds so that their texture/audio groups match what the config says they should have.',
    );
    process.exit(1);
  }
  await applyGroupAssignments(yypFile);
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Available commands: init, sync-groups`);
  process.exit(1);
}

function askingForHelp(arg: string) {
  return ['-h', '--help', 'help'].includes(arg);
}
