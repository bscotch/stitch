/**
 * Regenerate `src/lib/igor/cliTypes.ts` from Igor's usage text.
 *
 * Usage (from packages/launcher):
 *   node scripts/generate-igor-types.mts                 # uses samples/igor-help.txt
 *   node scripts/generate-igor-types.mts <path/to/Igor>  # runs `Igor --help` first and updates samples/igor-help.txt
 *
 * Igor exits with code 127 for `--help` ("unknown option") but still prints
 * the full usage text, so the exit code is ignored.
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIgorHelp, renderIgorTypes } from '../src/lib/igor/parseHelp.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helpFile = path.join(root, 'samples', 'igor-help.txt');
const outFile = path.join(root, 'src', 'lib', 'igor', 'cliTypes.ts');

const igorPath = process.argv[2];
let source = 'samples/igor-help.txt';
if (igorPath) {
  const result = spawnSync(igorPath, ['--help'], { encoding: 'utf8' });
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!text.includes('Supported Workers and Commands')) {
    throw new Error(`Unexpected output from "${igorPath} --help":\n${text}`);
  }
  await writeFile(helpFile, text);
  source = `${source} (captured from ${path.basename(igorPath)})`;
}

const help = parseIgorHelp(await readFile(helpFile, 'utf8'));
const prettier = await import('prettier');
const formatted = await prettier.format(renderIgorTypes(help, source), {
  ...(await prettier.resolveConfig(outFile)),
  filepath: outFile,
});
await writeFile(outFile, formatted);
console.log(
  `Wrote ${outFile}: ${help.options.length} options, ${Object.keys(help.workers).length} workers`,
);
