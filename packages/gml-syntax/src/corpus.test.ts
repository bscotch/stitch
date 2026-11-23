/**
 * Structural invariants, checked against every GML file in a corpus:
 * - The token stream is lossless and contiguous.
 * - Every node lies within its parent, and siblings don't overlap.
 *
 * The default corpus is the sample GML in this repo. Add real projects by
 * setting `GML_SYNTAX_CORPUS_DIRS` to one or more directories (separated by
 * the platform's path delimiter). For those, only the invariants are
 * asserted; diagnostic counts are logged for review.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { parse, type ParseResult } from './parser.ts';
import { untokenize } from './test.lib.ts';
import { childrenOf, walk } from './walk.ts';

const sampleDir = '../parser/samples';
/** Sample files that intentionally contain syntax errors */
const intentionallyInvalid = new Set(['project/scripts/Recovery/Recovery.gml']);

function* gmlFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* gmlFiles(path);
    else if (name.endsWith('.gml')) yield path;
  }
}

function assertInvariants(parsed: ParseResult, file: string) {
  assert.equal(untokenize(parsed), parsed.text, `${file}: not lossless`);
  let at = 0;
  for (const token of parsed.tokens) {
    assert.equal(token.start, at, `${file}: tokens not contiguous`);
    at = token.end;
  }
  walk(parsed.ast, (node) => {
    assert.ok(node.start <= node.end, `${file}: ${node.kind} has end < start`);
    let previousEnd = node.start;
    for (const child of childrenOf(node)) {
      assert.ok(
        child.start >= previousEnd && child.end <= node.end,
        `${file}: ${child.kind}@${child.start} is outside its ${node.kind} parent or overlaps a sibling`,
      );
      previousEnd = child.end;
    }
  });
}

describe('Corpus', function () {
  it('parses the sample GML files without errors', function () {
    let count = 0;
    for (const file of gmlFiles(sampleDir)) {
      const name = relative(sampleDir, file).replace(/\\/g, '/');
      const parsed = parse(readFileSync(file, 'utf8'));
      assertInvariants(parsed, name);
      const errors = parsed.diagnostics.filter((d) => d.severity === 'error');
      if (intentionallyInvalid.has(name)) {
        assert.ok(errors.length > 0, `${name}: expected errors`);
      } else {
        assert.deepEqual(errors, [], `${name}: unexpected errors`);
      }
      count++;
    }
    assert.ok(count > 0, 'No sample files found');
  });

  const extraDirs = (process.env.GML_SYNTAX_CORPUS_DIRS || '')
    .split(delimiter)
    .filter(Boolean);
  for (const dir of extraDirs) {
    it(`upholds invariants for an external corpus (${extraDirs.indexOf(dir) + 1})`, function () {
      let files = 0;
      let errors = 0;
      let warnings = 0;
      const start = performance.now();
      for (const file of gmlFiles(dir)) {
        const parsed = parse(readFileSync(file, 'utf8'));
        assertInvariants(parsed, relative(dir, file));
        for (const d of parsed.diagnostics) {
          if (d.severity === 'error') errors++;
          else warnings++;
        }
        files++;
      }
      console.log(
        `  ${files} files, ${errors} errors, ${warnings} warnings, ${Math.round(performance.now() - start)}ms`,
      );
    });
  }
});
