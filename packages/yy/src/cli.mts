#!/usr/bin/env node

import { ok } from 'assert';
import { Yy } from './Yy.js';
import { setProjectVersion } from './versioning.js';

const [command, ...args] = process.argv.slice(2);

if (command === 'diff') {
  const [firstYyFile, secondYyFile] = args;
  if (!firstYyFile || askingForHelp(firstYyFile)) {
    // Show help info
    console.error('Usage: yy diff <firstYyFile> <secondYyFile>');
    process.exit(1);
  }
  ok(firstYyFile, 'First argument must be a yy file path');
  ok(secondYyFile, 'Second argument must be a Yy file path');
  const firstYy = Yy.readSync(firstYyFile);
  const secondYy = Yy.readSync(secondYyFile);
  const diff = Yy.diff(firstYy, secondYy);
  console.log(JSON.stringify(diff, null, 2));
} else if (command === 'version') {
  const [yypFile, newVersion] = args;
  if (!yypFile || askingForHelp(yypFile)) {
    // Show help info, including description that this sets the version for all platforms
    console.error('Usage: yy version <yypFile> <newVersion>');
    console.error(
      "\nSets the version in the project's Options files for all platforms. Allowed version formats include: 0.0.0, 0.0.0.0, and 0.0.0-rc.0",
    );
    process.exit(1);
  }
  ok(newVersion, 'New version must be provided as the second argument');
  await setProjectVersion(yypFile, newVersion);
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Available commands: diff, version`);
  process.exit(1);
}

function askingForHelp(arg: string) {
  return ['-h', '--help', 'help'].includes(arg);
}
