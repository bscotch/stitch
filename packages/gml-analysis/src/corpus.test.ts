/**
 * Analyze real projects, set with `GML_ANALYSIS_CORPUS_DIRS` (separated by
 * the platform's path delimiter), checking that analysis completes and
 * settles. Logs timing and diagnostic counts.
 */
import { GameMakerProject } from '@bscotch/gamemaker-project';
import assert from 'node:assert/strict';
import { delimiter } from 'node:path';
import { describe, it } from 'node:test';
import { fileDiagnostics } from './diagnostics.ts';
import { analyzeProject } from './project.ts';

const dirs = (process.env.GML_ANALYSIS_CORPUS_DIRS || '')
  .split(delimiter)
  .filter(Boolean);

describe('Analysis corpus', function () {
  for (const [i, dir] of dirs.entries()) {
    it(`analyzes an external project (${i + 1})`, async function () {
      const start = performance.now();
      const project = await GameMakerProject.open(dir);
      const analyzer = await analyzeProject(project);
      const elapsed = Math.round(performance.now() - start);
      // Nothing is left to settle
      assert.equal(analyzer.analyze().checked.size, 0);
      const counts: Record<string, number> = {};
      for (const id of analyzer.fileIds) {
        for (const d of fileDiagnostics(analyzer, id))
          counts[d.code] = (counts[d.code] ?? 0) + 1;
      }
      console.log(`  ${analyzer.fileIds.length} files in ${elapsed}ms`, counts);
    });
  }
});
