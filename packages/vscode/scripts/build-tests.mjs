/**
 * Bundle the end-to-end tests (`test/e2e/*.mts`) into `out/test/*.cjs`, to be
 * loaded inside VS Code by `test/runTests.mts`.
 */
import esbuild from 'esbuild';
import fs from 'node:fs';

const entryPoints = fs
  .readdirSync('./test/e2e')
  .filter((f) => f === 'index.mts' || f.endsWith('.test.mts'))
  .map((f) => `./test/e2e/${f}`);

fs.rmSync('./out/test', { recursive: true, force: true });
await esbuild.build({
  entryPoints,
  bundle: true,
  outdir: './out/test',
  outExtension: { '.js': '.cjs' },
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  sourcemap: 'inline',
  // Provided by VS Code, and loaded from node_modules
  external: ['vscode', 'mocha'],
});
