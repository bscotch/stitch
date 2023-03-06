/**
 * Open one of the sample projects in the appropriate
 * IDE version.
 *
 * Assumes that CWD is the Stitch project root
 */

import { ok } from 'assert';
import { execSync } from 'child_process';
import { projectVersions } from './sampleInfo.mjs';

/**
 *
 * @param {string} [arg]
 * @returns {string|undefined}
 */
function argToVersion(arg) {
  if (!arg) {
    return;
  }
  if (arg.match(/^\d+$/)) {
    // Then treat as an INDEX
    arg = projectVersions[+arg];
  }
  ok(
    arg && projectVersions.includes(arg),
    `${arg} is not a valid project version`,
  );
  return arg;
}

const sample = argToVersion(process.argv[2]);
ok(sample, 'Must specify a sample project by index or version');
const ide = argToVersion(process.argv[3]) || sample;

execSync(`node stitch.mjs open --project samples/${sample} --ide ${ide}`);
