/**
 * Load-time benchmark, used as a baseline during the parser overhaul.
 *
 * Usage (from packages/parser):
 *   node scripts/bench-load.ts [projectDir] [iterations]
 *
 * Defaults to `samples/project`, or `GML_PARSER_SAMPLE_PROJECT_DIR` if set.
 */
import { performance } from 'node:perf_hooks';
import { Project } from '../src/project.ts';
import { setLogger } from '../src/logger.ts';

const projectDir =
  process.argv[2] ||
  process.env.GML_PARSER_SAMPLE_PROJECT_DIR ||
  'samples/project';
const iterations = Number(process.argv[3] || 5);

const noop = () => {};
setLogger({
  log: noop,
  info: noop,
  debug: noop,
  warn: noop,
  error: noop,
  dir: noop,
});

const times: number[] = [];
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  await Project.initialize(projectDir);
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
console.log(
  JSON.stringify(
    {
      projectDir,
      iterations,
      medianMs: Math.round(median),
      minMs: Math.round(times[0]),
      maxMs: Math.round(times.at(-1)!),
    },
    null,
    2,
  ),
);
