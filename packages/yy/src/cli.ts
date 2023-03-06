import { ok } from 'assert';
import { Yy } from './Yy.js';

const [command, ...args] = process.argv.slice(2);

if (command === 'diff') {
  const [firstYyFile, secondYyFile] = args;
  ok(firstYyFile, 'First Yy file must be specified');
  ok(secondYyFile, 'Second Yy file must be specified');
  const firstYy = Yy.readSync(firstYyFile);
  const secondYy = Yy.readSync(secondYyFile);
  const diff = Yy.diff(firstYy, secondYy);
  console.log(JSON.stringify(diff, null, 2));
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
