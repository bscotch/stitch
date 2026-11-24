/**
 * Benchmark loading a project, and report anything that couldn't be loaded.
 *
 * Usage: node scripts/bench-load.ts <path/to/project> [runs=3]
 */
import { GameMakerProject } from '../src/index.ts';

const [dir, runsArg] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: node scripts/bench-load.ts <path/to/project> [runs]');
  process.exit(1);
}
const runs = Number(runsArg) || 3;
const times: number[] = [];
let project!: GameMakerProject;
for (let i = 0; i < runs; i++) {
  const start = performance.now();
  project = await GameMakerProject.open(dir);
  times.push(performance.now() - start);
}
const gml = project.listAssets().reduce((n, a) => n + a.gmlFiles.length, 0);
const orphaned = project
  .listAssets()
  .reduce((n, a) => n + a.orphanedGmlFiles.length, 0);
console.log({
  assets: project.assetCount,
  unloaded: project.unloadedResources.length,
  gmlFiles: gml,
  orphanedGmlFiles: orphaned,
  loadMs: times.map((t) => Math.round(t)),
});
