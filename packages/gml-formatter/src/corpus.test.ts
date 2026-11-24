/**
 * Formats every GML file in a corpus with every preset, checking that:
 * - Formatting succeeds. (Its built-in verification guarantees the output
 *   has the same tokens and comments as the input.)
 * - Formatting is idempotent.
 *
 * The default corpus is the sample GML in this repo. Add real projects by
 * setting `GML_FORMATTER_CORPUS_DIRS` to one or more directories (separated
 * by the platform's path delimiter). Change statistics are logged for those.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { formatGml, GmlFormatError } from './format.ts';
import { presets, type PresetName } from './options.ts';

function* gmlFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* gmlFiles(path);
    else if (name.endsWith('.gml')) yield path;
  }
}

function checkCorpus(dir: string, preset: PresetName) {
  let files = 0;
  let changedLines = 0;
  let totalLines = 0;
  for (const file of gmlFiles(dir)) {
    const source = readFileSync(file, 'utf8');
    let formatted: string;
    try {
      formatted = formatGml(source, { preset }).text;
    } catch (err) {
      if (err instanceof GmlFormatError && err.diagnostics.length) continue;
      throw new Error(`${relative(dir, file)}: ${(err as Error).message}`, {
        cause: err,
      });
    }
    assert.equal(
      formatGml(formatted, { preset }).text,
      formatted,
      `${relative(dir, file)}: not idempotent`,
    );
    const before = source.split(/\r?\n/).map((l) => l.trimEnd());
    const after = formatted.split(/\r?\n/);
    const remaining = new Map<string, number>();
    for (const line of before)
      remaining.set(line, (remaining.get(line) ?? 0) + 1);
    for (const line of after) {
      const count = remaining.get(line) ?? 0;
      if (count) remaining.set(line, count - 1);
      else changedLines++;
    }
    totalLines += before.length;
    files++;
  }
  return { files, changedLines, totalLines };
}

describe('Formatter corpus', function () {
  for (const preset of Object.keys(presets) as PresetName[]) {
    it(`formats the sample GML files (${preset})`, function () {
      const { files } = checkCorpus('../parser/samples', preset);
      assert.ok(files > 0, 'No sample files found');
    });
  }

  const extraDirs = (process.env.GML_FORMATTER_CORPUS_DIRS || '')
    .split(delimiter)
    .filter(Boolean);
  for (const [i, dir] of extraDirs.entries()) {
    for (const preset of Object.keys(presets) as PresetName[]) {
      it(`formats an external corpus (${i + 1}, ${preset})`, function () {
        const { files, changedLines, totalLines } = checkCorpus(dir, preset);
        console.log(
          `  ${preset}: ${files} files, ${changedLines}/${totalLines} lines changed (ignoring trailing whitespace) (${((100 * changedLines) / totalLines).toFixed(1)}%)`,
        );
      });
    }
  }
});
