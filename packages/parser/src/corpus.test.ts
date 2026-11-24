/**
 * Analyze real projects, set with `GML_ANALYSIS_CORPUS_DIRS` (separated by
 * the platform's path delimiter). Checks that analysis completes and
 * settles, and that results after edits match a fresh analysis. Logs timing
 * and diagnostic counts.
 */
import { GameMakerProject } from '@bscotch/gamemaker-project';
import assert from 'node:assert/strict';
import { delimiter } from 'node:path';
import { describe, it } from 'node:test';
import { GmlAnalyzer } from './analyzer.ts';
import { fileDiagnostics } from './diagnostics.ts';
import { analyzeProject, projectInfo } from './project.ts';

const dirs = (process.env.GML_ANALYSIS_CORPUS_DIRS || '')
  .split(delimiter)
  .filter(Boolean);

/** Everything a file's references resolve to, for comparing analyzers */
function summarize(analyzer: GmlAnalyzer, id: string): string {
  return analyzer
    .getAnalysis(id)!
    .refs.map((r) => {
      const s = analyzer.table.getSymbol(r.symbol);
      return `${r.start}:${r.symbol}:${r.implicit ? 'i' : ''}:${s ? s.kind + JSON.stringify(s.type) : ''}`;
    })
    .join('\n');
}

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
        for (const d of fileDiagnostics(analyzer, id)) {
          counts[d.code] = (counts[d.code] ?? 0) + 1;
        }
      }
      console.log(`  ${analyzer.fileIds.length} files in ${elapsed}ms`, counts);

      // Edit some files: results must match analyzing the edited project
      // from scratch
      const scripts = analyzer.fileIds.filter((f) => f.startsWith('scripts/'));
      const events = analyzer.fileIds.filter((f) => f.startsWith('objects/'));
      const edits: [string, (text: string) => string][] = [
        [
          scripts[0],
          (t) => `${t}\nfunction __corpus_test_fn() { return "s"; }`,
        ],
        [events[0], (t) => `${t}\n__corpus_test_var = 1;`],
        [scripts[1] ?? scripts[0], (t) => t.slice(0, Math.floor(t.length / 2))],
      ];
      for (const [id, edit] of edits) {
        const file = analyzer.getFile(id)!;
        const editStart = performance.now();
        analyzer.setFile(file.file, edit(file.text));
        analyzer.analyze();
        console.log(
          `  Edit re-analyzed in ${Math.round(performance.now() - editStart)}ms`,
        );
      }
      const fresh = new GmlAnalyzer(analyzer.natives);
      fresh.setProject(projectInfo(project));
      for (const id of analyzer.fileIds) {
        const file = analyzer.getFile(id)!;
        fresh.setFile(file.file, file.text);
      }
      fresh.analyze();
      const differing = analyzer.fileIds.filter(
        (id) => summarize(analyzer, id) !== summarize(fresh, id),
      );
      assert.deepEqual(differing, []);
    });
  }
});
