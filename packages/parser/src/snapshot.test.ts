import { pathy } from '@bscotch/pathy';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Project } from './project.ts';
import { snapshotProject } from './snapshot.lib.ts';

/**
 * Golden feature-snapshot regression test.
 *
 * Set `UPDATE_SNAPSHOTS=1` to (re)write the baseline after reviewing
 * that any differences are intended.
 */
describe('Feature snapshot', function () {
  it('matches the golden snapshot for the sample project', async function () {
    const project = await Project.initialize('samples/project');
    const actual = snapshotProject(project);
    const baselineFile = pathy('snapshots/project.json');
    if (process.env.UPDATE_SNAPSHOTS || !(await baselineFile.exists())) {
      await baselineFile.write(actual);
      return;
    }
    const expected = await baselineFile.read();
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(actual)),
      expected,
      'Feature snapshot changed. Review the diff, then run with UPDATE_SNAPSHOTS=1 if intended.',
    );
  });
});
