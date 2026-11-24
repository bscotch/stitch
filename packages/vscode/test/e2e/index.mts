/**
 * Entry point for the tests inside VS Code: runs every `*.test.cjs` file
 * next to it (built from `test/e2e/*.test.mts`), in name order. Tests in
 * later files can rely on the state left by earlier ones.
 */
import Mocha from 'mocha';
import fs from 'node:fs';
import path from 'node:path';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', timeout: 60_000, color: true });
  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.cjs'))
    .sort();
  for (const file of files) mocha.addFile(path.join(__dirname, file));
  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) =>
      failures ? reject(new Error(`${failures} test(s) failed.`)) : resolve(),
    );
  });
}
