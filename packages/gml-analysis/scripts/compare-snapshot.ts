/**
 * Print a comparison of this package's analysis of the sample project with
 * the golden snapshot recorded from the old `@bscotch/gml-parser`.
 *
 * Usage: node scripts/compare-snapshot.ts [--verbose]
 */
import { compareWithOldSnapshot } from '../src/snapshot.compare.ts';

const { counts, report, diagReport, sigReport, completionReport } =
  await compareWithOldSnapshot(process.argv.includes('--verbose'));
console.log('References:', counts);
console.log(report.join('\n'));
console.log(`\nDiagnostics (${diagReport.length} differences):`);
console.log(diagReport.join('\n'));
console.log(`\nSignatures (${sigReport.length} differences):`);
console.log(sigReport.join('\n'));
console.log(`\nCompletions (${completionReport.length} differences):`);
console.log(completionReport.join('\n'));
